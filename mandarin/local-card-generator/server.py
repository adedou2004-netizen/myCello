import argparse
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from threading import Lock
import traceback
from urllib.request import urlopen
from uuid import uuid4
import webbrowser

from cards import card_details, downloads_folder, render_card, save_card
from research import download_research, research_ready, research_word


ROOT = Path(__file__).resolve().parent
MODEL = "stable-diffusion-v1-5/stable-diffusion-v1-5"
MODEL_CACHE = ROOT / "model-cache"
MODEL_FILES = [
    "model_index.json",
    "feature_extractor/*.json", "scheduler/*.json", "tokenizer/*",
    "safety_checker/config.json", "safety_checker/model.fp16.safetensors",
    "text_encoder/config.json", "text_encoder/model.fp16.safetensors",
    "unet/config.json", "unet/diffusion_pytorch_model.fp16.safetensors",
    "vae/config.json", "vae/diffusion_pytorch_model.fp16.safetensors",
]
ADDRESS = ("127.0.0.1", 8765)
HOST = f"{ADDRESS[0]}:{ADDRESS[1]}"
ORIGIN = f"http://{HOST}"
LOCAL_HOSTS = {HOST, f"localhost:{ADDRESS[1]}"}


@dataclass
class Preview:
    token: str
    filename: str
    art: object
    png: bytes


class Illustrator:
    pipeline = None

    def draw(self, scene):
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        import torch
        from diffusers import DPMSolverMultistepScheduler, StableDiffusionPipeline

        if self.pipeline is None:
            use_cuda = torch.cuda.is_available()
            try:
                pipeline = StableDiffusionPipeline.from_pretrained(
                    MODEL, cache_dir=MODEL_CACHE, variant="fp16",
                    torch_dtype=torch.float16 if use_cuda else torch.float32,
                    use_safetensors=True, local_files_only=True,
                )
            except OSError as error:
                raise RuntimeError("The local model is missing or incomplete. Close this window and rerun setup.") from error
            pipeline.scheduler = DPMSolverMultistepScheduler.from_config(pipeline.scheduler.config)
            if use_cuda:
                pipeline.enable_model_cpu_offload()
            print(f"Local image generation device: {'CUDA' if use_cuda else 'CPU'}", flush=True)
            self.pipeline = pipeline

        result = self.pipeline(
            prompt=f"{scene} Warm watercolor storybook illustration, one focal subject, bold outlines, uncluttered background.",
            negative_prompt="text, letters, words, typography, watermark, logo, collage, repeating pattern, wallpaper, blurry",
            width=512, height=512, num_inference_steps=25,
        )
        if result.nsfw_content_detected and result.nsfw_content_detected[0]:
            raise ValueError("The illustration was blocked by the local model. Revise the scene and try again.")
        return result.images[0]


class Generator(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, output):
        super().__init__(ADDRESS, Handler)
        self.output = output
        self.session = uuid4().hex
        self.illustrator = Illustrator()
        self.lock = Lock()
        self.preview = None


class Handler(BaseHTTPRequestHandler):
    def send_data(self, status, content, content_type, headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(content)

    def respond(self, status, **data):
        self.send_data(status, json.dumps(data).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self):
        if self.headers.get("Host") not in LOCAL_HOSTS:
            self.respond(HTTPStatus.FORBIDDEN, error="Open the generator using its loopback address.")
            return
        if self.path == "/health":
            self.respond(HTTPStatus.OK, service="mylexigo-card-studio", research=research_ready(), session=self.server.session)
            return
        pages = {
            "/": (ROOT / "interface.html", "text/html; charset=utf-8"),
            "/studio.css": (ROOT / "studio.css", "text/css; charset=utf-8"),
            "/studio.js": (ROOT / "studio.js", "text/javascript; charset=utf-8"),
            "/assets/mylexigo.webp": (ROOT / "assets/mylexigo.webp", "image/webp"),
            "/assets/example-card.webp": (ROOT / "assets/example-card.webp", "image/webp"),
            "/assets/feather.svg": (ROOT / "assets/feather.svg", "image/svg+xml"),
            "/vocabulary-card-rules.md": (ROOT.parent / "vocabulary-card-rules.md", "text/plain; charset=utf-8"),
        }
        page = pages.get(self.path)
        if page is None or not page[0].is_file():
            self.respond(HTTPStatus.NOT_FOUND, error="Page unavailable.")
            return
        self.send_data(HTTPStatus.OK, page[0].read_bytes(), page[1])

    def do_POST(self):
        host = self.headers.get("Host")
        if host not in LOCAL_HOSTS or self.headers.get("Origin") != f"http://{host}":
            self.respond(HTTPStatus.FORBIDDEN, error="Submit requests from the local generator page.")
            return
        if self.path not in {"/research", "/preview", "/revise", "/save"}:
            self.respond(HTTPStatus.NOT_FOUND, error="Page unavailable.")
            return
        if self.headers.get_content_type() != "application/json":
            self.respond(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, error="Expected card data as JSON.")
            return
        if not self.server.lock.acquire(blocking=False):
            self.respond(HTTPStatus.CONFLICT, error="A card is already being generated or saved.")
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 16000:
                raise ValueError("Card data is missing or too large.")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Expected a set of card fields.")
            if self.path == "/research":
                self.respond(HTTPStatus.OK, **research_word(data.get("word")))
            elif self.path in {"/preview", "/revise"}:
                details = card_details(data)
                if self.path == "/revise":
                    preview = self.server.preview
                    if preview is None or data.get("token") != preview.token:
                        self.respond(HTTPStatus.CONFLICT, error="This preview expired. Regenerate the illustration to continue.")
                        return
                    art = preview.art
                else:
                    art = self.server.illustrator.draw(details["scene"])
                png = render_card(details, art)
                token = uuid4().hex
                self.server.preview = Preview(token, details["filename"], art, png)
                self.send_data(HTTPStatus.OK, png, "image/png", {
                    "X-Card-Token": token, "X-Card-Filename": details["filename"],
                })
            else:
                preview = self.server.preview
                if preview is None or data.get("token") != preview.token:
                    self.respond(HTTPStatus.CONFLICT, error="Generate a current preview before saving.")
                    return
                target = save_card(preview.png, preview.filename, self.server.output)
                self.server.preview = None
                self.respond(HTTPStatus.CREATED, path=str(target))
        except (BrokenPipeError, ConnectionResetError):
            pass
        except ValueError as error:
            self.respond(HTTPStatus.BAD_REQUEST, error=str(error))
        except LookupError as error:
            self.respond(HTTPStatus.NOT_FOUND, error=str(error))
        except PermissionError:
            self.respond(HTTPStatus.INTERNAL_SERVER_ERROR, error="Windows denied access to Downloads/Mandarin-Cards. Check folder access and try saving again.")
        except Exception as error:
            traceback.print_exc()
            message = str(error) if type(error) is RuntimeError else "The operation failed. See the generator window for details."
            self.respond(HTTPStatus.INTERNAL_SERVER_ERROR, error=message)
        finally:
            self.server.lock.release()


def download_model():
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["HF_HOME"] = str(MODEL_CACHE)
    from huggingface_hub import snapshot_download

    snapshot_download(MODEL, cache_dir=MODEL_CACHE, allow_patterns=MODEL_FILES)


def main():
    parser = argparse.ArgumentParser(description="Run the Windows vocabulary card generator.")
    parser.add_argument("--download-model", action="store_true")
    parser.add_argument("--download-research", action="store_true")
    parser.add_argument("--open-browser", action="store_true")
    args = parser.parse_args()
    if args.download_model:
        download_model()
        return
    if args.download_research:
        download_research()
        return
    if args.open_browser and studio_running():
        webbrowser.open(f"{ORIGIN}/")
        return

    output = downloads_folder() / "Mandarin-Cards"
    try:
        server = Generator(output)
    except OSError:
        if args.open_browser and studio_running():
            webbrowser.open(f"{ORIGIN}/")
            return
        raise
    with server:
        print(f"Local Vocabulary Card Generator: {ORIGIN}/", flush=True)
        print(f"Saving approved PNGs to {output}", flush=True)
        if args.open_browser:
            webbrowser.open(f"{ORIGIN}/")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


def studio_running():
    try:
        with urlopen(f"{ORIGIN}/health", timeout=2) as response:
            return json.load(response).get("service") == "mylexigo-card-studio"
    except (OSError, ValueError, AttributeError):
        return False


if __name__ == "__main__":
    main()

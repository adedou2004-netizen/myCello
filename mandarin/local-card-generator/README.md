# myLexiGo Vocabulary Card Studio

Double-click [Start Generator.cmd](Start%20Generator.cmd) in Windows Explorer. The first run downloads the local Python dependencies, illustration weights, and research dictionaries. Keep the window open while using the studio. Once the downloads finish, the launcher opens `http://127.0.0.1:8765/` and the studio runs offline.

The launcher uses Python 3.13 and tries to install the NVIDIA CUDA build of PyTorch for the RTX 3050. Generation can also run on the CPU, where previews take longer. The card renderer uses Windows' Microsoft YaHei fonts. Illustration runs on the PC with the [Stable Diffusion 1.5 model](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5). After setup, card generation works offline and requires no account, API key, or paid inference.

## From the Mandarin app

Open the local `mandarin/index.html` in your browser. Expand **Administration** and select **Local Vocabulary Card Generator**. The menu also appears when the app is served on localhost.

1. Enter a Mandarin word such as 草莓 and select **Research & Create**. The studio looks up readings and meanings, breaks down each character, and prepares a memory cue and illustration. Pick the intended reading or meaning if the dictionary offers several.
2. Review the proposed card. **Edit Mnemonic** can update the text while retaining the image. Changing the scene or selecting **Regenerate Illustration** draws a new image. **Manual card details** lets you supply missing entries or adjust the full card, including examples and French.
3. Select **Approve & Save** after reviewing the preview. The studio writes the PNG to the Windows Downloads folder under `Mandarin-Cards`. For 草莓 the first filename is `strawberry_cao3-mei2.png`. Later approvals use available versioned filenames such as `strawberry_cao3-mei2-v2.png`.

Research draws from [CC-CEDICT](https://cc-cedict.org/editor/editor.php?handler=Download) (CC BY-SA 4.0) and [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) (`dictionary.txt`, LGPL 3.0 or later). The studio shows the source links beside the research results. Coverage varies for character history, French equivalents, and examples. The mnemonic is a proposed memory aid. The separate [vocabulary-card rules](../vocabulary-card-rules.md) describe what to check during review.

## Restart or repair

If the page shows that the engine is disconnected, start the launcher again and select **Reconnect**. Opening `interface.html` as a file displays the launch instructions. If the model cache is incomplete after installation, close the generator, delete the `.venv/card-generator-ready` marker, and run the launcher again. If research data is missing, the launcher downloads it the next time it starts online.

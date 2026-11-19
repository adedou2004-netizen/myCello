# myLexiGo Vocabulary Card Studio

Double-click [Start Generator.cmd](Start%20Generator.cmd) in Windows Explorer. The first run downloads the local Python dependencies, illustration weights, and research dictionaries. Keep the window open while using the studio. Once the downloads finish, the launcher opens `http://127.0.0.1:8765/` and the studio runs offline.

The launcher uses Python 3.13 and tries to install the NVIDIA CUDA build of PyTorch for the RTX 3050. Generation can also run on the CPU, where previews take longer. The card renderer uses Windows' Microsoft YaHei fonts. Illustration runs on the PC with the [Stable Diffusion 1.5 model](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5). After setup, card generation works offline and requires no account, API key, or paid inference.

## From the Mandarin app

Open the local `mandarin/index.html` in your browser. Expand **Administration** and select **Local Vocabulary Card Generator**. The menu also appears when the app is served on localhost.

1. Choose **Single Word** or **Full Lesson**. For a lesson, enter a title and paste up to 20 words separated by lines, spaces, or commas. The studio skips duplicate words.
2. **Research Only** prepares drafts for review without running the image model. Select a word and use **Approve & Generate** when ready. **Research & Create** queues illustrations automatically for new cards with complete research. Either mode lets you pick a reading or sense, edit the mnemonic, and review each card.
3. Select **Approve & Save** for each finished card. PNGs go to `Downloads/Mandarin-Cards`. Matching approved PNGs are reused across lessons. Explicit regeneration creates a new draft, and a later approval uses a versioned filename such as `strawberry_cao3-mei2-v2.png`.
4. Open **Saved lessons** to continue later. Closing the browser leaves the server's current queue running. After a server restart, open the lesson and select **Resume** for interrupted work. Each failed word has its own **Retry** action.

Lesson progress, research, and draft images are saved in the ignored `studio-data/` folder beside the launcher. Approved PNGs from older versions are matched by their expected filename. Newly exported PNGs also include the Chinese headword in their metadata.

Research uses [CC-CEDICT](https://cc-cedict.org/editor/editor.php?handler=Download), [Make Me a Hanzi](https://github.com/skishore/makemeahanzi), and the reviewed portion of the [Dong Chinese Character Wiki](https://www.dong-chinese.com/wiki) data. Selected characters also have links to separately checked primary references. The studio distinguishes overlapping dataset evidence from independently checked notes and labels invented memory aids. Its [sentence corpus](https://github.com/krmanik/Chinese-Example-Sentences) contains automatic pinyin and translations. Review examples for the intended sense. If no matching example is available, add Chinese, pinyin, and English in **Manual card details** before generating. History coverage varies by character. See the [vocabulary-card rules](../vocabulary-card-rules.md) for review criteria.

## Restart or repair

If the page shows that the engine is disconnected, start the launcher again and select **Reconnect**. If an older studio is still running on port 8765, the launcher opens the batch studio on port 8766 so the older tab can retain its draft. Opening `interface.html` as a file displays the launch instructions. If the model cache is incomplete after installation, close the generator, delete the `.venv/card-generator-ready` marker, and run the launcher again. If research data is missing, the launcher downloads it the next time it starts online.

Run the lesson tests from this folder with `.venv/Scripts/python.exe -m unittest -v test_lessons`.

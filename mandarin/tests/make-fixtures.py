"""Synthetic OCR fixtures, not a substitute for real phone photographs."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
out=Path(__file__).parent/'results'/'fixtures';out.mkdir(exist_ok=True)
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def create(name,lines,size=72,pinyin=None):
    image=Image.new('RGB',(1400,600),'white');d=ImageDraw.Draw(image);f=ImageFont.truetype(font,size)
    y=100
    if pinyin:
        d.text((100,50),pinyin,font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30),fill='black')
    for line in lines:
        d.text((100,y),line,font=f,fill='black');y+=size+40
    image.save(out/(name+'.png'));return image
create('clear',['她今天非常'])
create('sentence',['她今天非常高兴。'])
create('multiline',['她今天非常高兴。','我也很高兴。'])
create('pinyin',['她今天非常'],pinyin='tā   jīn tiān   fēi cháng')
create('dense',['她今天非常高兴。我们一起学习中文。','这个故事很好看。'],size=32)
create('no-chinese',['KEYBOARD DESK 12345'])
Image.new('RGB',(1400,600),'white').save(out/'blank.png')
create('poor',['她今天非常'],size=24).filter(ImageFilter.GaussianBlur(4)).save(out/'poor.png')

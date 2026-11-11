"""Render original, code-drawn artwork. Optional maintainer dependency: Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]

def icon(size):
    scale = 8
    canvas = Image.new('RGBA', (128*scale, 128*scale))
    draw = ImageDraw.Draw(canvas)
    def line(points, color, width):
        pts = [(round(x*scale), round(y*scale)) for x, y in points]
        draw.line(pts, fill=color, width=round(width*scale), joint='curve')
        r = width*scale/2
        for x, y in (pts[0], pts[-1]):
            draw.ellipse((x-r, y-r, x+r, y+r), fill=color)
    def quad(a,b,c):
        return [((1-t)**2*a[0]+2*(1-t)*t*b[0]+t*t*c[0],
                 (1-t)**2*a[1]+2*(1-t)*t*b[1]+t*t*c[1]) for t in [i/30 for i in range(31)]]
    draw.rounded_rectangle((0,0,128*scale-1,128*scale-1), radius=28*scale, fill='#123e31')
    line([(29,89),(29,39),(58,39)]+quad((58,39),(74,39),(74,55))+[(74,79)],'#f4fff8',9)
    line([(47,50),(47,89),(72,89)]+quad((72,89),(88,89),(88,73))+[(88,39)],'#f4fff8',9)
    for points in [[(27,25),(96,25)],[(89,18),(96,25),(89,32)],[(101,103),(32,103)],[(39,96),(32,103),(39,110)]]:
        line(points,'#8ee6b4',7)
    return canvas.resize((size,size),Image.Resampling.LANCZOS)

def font(size, bold=False):
    candidates = [Path('C:/Windows/Fonts') / ('segoeuib.ttf' if bold else 'segoeui.ttf'),
                  Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path),size)
    return ImageFont.load_default(size=size)

def main():
    (ROOT/'icons').mkdir(exist_ok=True)
    for size in (16,32,48,128):
        icon(size).save(ROOT/f'icons/icon{size}.png')
    (ROOT/'docs').mkdir(exist_ok=True)
    image=Image.new('RGB',(1440,820),'#f3f7f4')
    d=ImageDraw.Draw(image)
    d.rectangle((0,0,1440,370),fill='#102e26')
    image.paste(icon(84),(76,66),icon(84))
    def text(x,y,value,size=22,color='#173c30',bold=False):
        d.text((x,y),value,font=font(size,bold),fill=color)
    text(184,69,'SHEKEL CONVERTER',19,'#9ce6bd',True)
    text(181,104,'Shop globally. Think in shekels.',48,'#ffffff',True)
    text(76,219,'The original price stays. A clearer comparison appears beside it.',26,'#c0d8cc')
    text(76,282,'DAILY RATES    /    LOCAL CONVERSION    /    OPTIONAL TAX ESTIMATES',17,'#9ce6bd',True)
    labels=[('01  CURRENCY CONTEXT','Australian store','$100.00 AUD','ILS 240.00','Recognizes AUD, not just a dollar sign.'),
            ('02  AT A GLANCE','European store','EUR 60.00','ILS 240.00','Keep the original. Compare in shekels.'),
            ('03  YOUR CHOICE','Import tax estimate','USD 100.00','ILS 414.00','Illustrative 18% addition included.')]
    for i,(label,store,original,converted,caption) in enumerate(labels):
        x=76+i*438
        d.rounded_rectangle((x,401,x+412,700),radius=18,fill='white',outline='#dce8e0',width=2)
        text(x+26,427,label,15,'#4c7964',True)
        text(x+26,475,store,26,bold=True)
        text(x+26,527,original,23,'#62756b')
        d.rounded_rectangle((x+26,574,x+386,633),radius=10,fill='#e3f3e8' if i<2 else '#fff0d5')
        text(x+42,581,converted,30,'#185534' if i<2 else '#815421',True)
        text(x+26,659,caption,16,'#62756b')
    text(76,739,'Illustrative preview · Example rates and prices · Actual extension interface is in Hebrew',18,'#62756b')
    text(76,772,'Tax display can be switched off independently. Currency conversion stays on.',17,'#62756b')
    image.save(ROOT/'docs/preview.png',optimize=True)
    print('Rendered four Chrome icons and docs/preview.png')

if __name__=='__main__':
    main()

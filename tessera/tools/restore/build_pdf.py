"""Assemble restored page images into an optimised PDF (JPEG, progressive, 4:2:0) with metadata and bookmarks."""
import img2pdf, pikepdf, io, json, sys
from PIL import Image
def build(pages, out, q, scale, page_mm, meta, marks):
    data = []
    for p in pages:
        im = Image.open(p).convert('RGB')
        if scale != 1: im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=2); data.append(b.getvalue())
    lay = img2pdf.get_layout_fun((img2pdf.mm_to_pt(page_mm[0]), img2pdf.mm_to_pt(page_mm[1])))
    raw = img2pdf.convert(data, layout_fun=lay)
    pdf = pikepdf.open(io.BytesIO(raw))
    with pdf.open_metadata() as m:
        m['dc:title'] = meta['title']; m['dc:creator'] = meta['creator']; m['dc:description'] = meta['description']
        m['dc:rights'] = meta['rights']; m['xmp:CreatorTool'] = 'Tessera restoration (python, OpenCV)'
    pdf.docinfo['/Title'] = meta['title']; pdf.docinfo['/Author'] = '; '.join(meta['creator'])
    pdf.docinfo['/Subject'] = meta['description']; pdf.docinfo['/Keywords'] = meta.get('keywords', '')
    with pdf.open_outline() as ol:
        for title, idx in marks: ol.root.append(pikepdf.OutlineItem(title, idx))
    pdf.Root.PageMode = pikepdf.Name.UseOutlines
    pdf.save(out, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)

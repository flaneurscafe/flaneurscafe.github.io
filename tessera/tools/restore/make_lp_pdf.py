import sys, re, json, os
sys.path.insert(0, '/home/claude/book'); from build_pdf import build
s = open('/home/claude/t/tessera/js/laplante.js').read()
P = json.loads(re.search(r'const LP_PLATES = (\{.*?\});', s).group(1))
GAL = {5, 6, 21, 25, 28, 43, 46, 54, 59, 61, 63, 64, 65, 66, 67, 68, 70, 71, 72}
front = ['f_001', 'f_003', 'f_005', 'f_007', 'f_008', 'f_009']
pages = [f'lp_pages/{f}.jpg' for f in front] + [f'lp_pages/p_plate{p:02d}.jpg' for p in range(1, 73)]
marks = [('Cover', 0), ('Title', 2), ('Introduction (E. Grasset, 1896)', 3)]
for p in range(1, 73):
    v = P[str(p)]; marks.append((f"Pl. {p} · {v[0]} / {v[1]} ({'study' if p % 3 == 1 else 'applications'}; {v[3]})", 5 + p))
meta = dict(title='La Plante et ses applications ornementales (1896), first series, complete: digitally restored edition',
            creator=['Eugène Grasset (ed.)', 'M. P. Verneuil', 'E. Hervegh', 'C. G. Schlumberger', 'Anna Martin', 'J. Milesi', 'G. Bourgeot', 'A. Poidevin', 'Marcelle Gaudin', 'Max Mangin'],
            description=('Paris, Librairie Centrale des Beaux-Arts, E. Lévy, 1896. Cover, title, introduction and plates 1-72. '
                         'Plates 1-72 except 19 and the text pages: Smithsonian Libraries copy, digitised for the Biodiversity Heritage Library '
                         '(Internet Archive planteetsesappl00Gras), public domain. Plates 5, 6, 21, 25, 28, 43, 46, 54, 59, 61, 63-68, 70-72: '
                         'source gallica.bnf.fr / Bibliothèque nationale de France (ark:/12148/btv1b10546212d). '
                         'Restoration for Tessera: pages straightened, plates aligned on one frame, paper flattened (yellowing, foxing haze, '
                         'shadows), stains outside the print removed; BnF ownership stamps kept. The printed image itself is not retouched.'),
            rights='Public domain work (1896). BnF images: free non-commercial reuse with the credit "Source gallica.bnf.fr / BnF".',
            keywords='Grasset; La Plante et ses applications ornementales; art nouveau; Verneuil; ornament; 1896')
os.makedirs('pdf', exist_ok=True)
mode = sys.argv[1]
if mode == 'full': build(pages, 'pdf/Grasset_La_Plante_1896_restored_complete.pdf', 82, 1.0, (313, 433), meta, marks)
else: build(pages, 'pdf/Grasset_La_Plante_1896_restored_web.pdf', int(sys.argv[2]), float(sys.argv[3]), (313, 433), meta, marks)

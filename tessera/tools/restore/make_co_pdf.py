import sys, os
sys.path.insert(0, '/home/claude/book'); from build_pdf import build
names = ['a_cover', 'b_title', 'c_preface1', 'c_preface2'] + [f'p_{i:02d}' for i in range(3, 61)]
pages = [f'pages/{n}.jpg' for n in names]
marks = [('Cover (original edition)', 0), ('Pl. 1 · Title', 1), ('Pl. 2 · Preface: De l’emploi du miroir (M.-P. V.)', 2)] + [(f'Pl. {i}', i + 1) for i in range(3, 61)]
meta = dict(title='Combinaisons ornementales se multipliant à l’infini à l’aide du miroir (c. 1901): digitally restored edition',
            creator=['M. P. Verneuil', 'G. Auriol', 'A. Mucha'],
            description=('Paris, Librairie Centrale des Beaux-Arts, c. 1901. Cover and the French preface "De l’emploi du miroir" (plate 2): '
                         'original edition, New York Public Library Digital Collections (760 px images, upscaled). Title and plates 3-60: '
                         'Internet Archive, item CombinaisonsOrnementales (high-resolution scan, probably of a later reprint). '
                         'Restoration for Tessera: pages straightened, paper flattened (yellowing, stains, shadows), specks removed, '
                         'one page size. The printed image itself is not retouched.'),
            rights='Public domain work.', keywords='Verneuil; Auriol; Mucha; Combinaisons ornementales; mirror; art nouveau; 1901')
os.makedirs('pdf', exist_ok=True)
if sys.argv[1] == 'full': build(pages, 'pdf/Verneuil_Auriol_Mucha_Combinaisons_ornementales_c1901_restored_complete.pdf', 82, 1.0, (320, 277), meta, marks)
else: build(pages, 'pdf/Verneuil_Auriol_Mucha_Combinaisons_ornementales_c1901_restored_web.pdf', int(sys.argv[2]), float(sys.argv[3]), (320, 277), meta, marks)

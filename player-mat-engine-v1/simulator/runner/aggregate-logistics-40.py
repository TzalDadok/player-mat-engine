import json, glob, pathlib, statistics
files=sorted(glob.glob('collected/**/*.json',recursive=True))
observations=[]
for f in files:
    data=json.loads(pathlib.Path(f).read_text())
    observations.extend(data.get('observations',[]))
expected=1280
summary=[]
for name in ('actual','red_completa_manual'):
    rows=[r for r in observations if r['variant']==name]
    done=[r for r in rows if r['status']=='completed']
    checkpoints={}
    for checkpoint in ('12','20'):
        applicable=[r for r in done if r.get('checks',{}).get(checkpoint)]
        winners=sum(bool(r['checks'][checkpoint]['lastWon']) for r in applicable)
        checkpoints[checkpoint]={'eligible':len(applicable),'last_wins':winners,'rate':winners/len(applicable) if applicable else None}
    def avg(key):
        return round(statistics.mean([r[key] for r in rows]),2) if rows else None
    summary.append({'variant':name,'played':len(rows),'completed':len(done),'avg_rounds':avg('rounds'),'avg_combats':avg('combats'),'avg_production':avg('production'),'avg_spending':avg('spending'),'remontadas':checkpoints})
result={'expected':expected,'observed':len(observations),'maps':len(files),'summary':summary}
pathlib.Path('hito5-logistics-40-consolidated.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
lines=['# Red logística: 40 mapas y bots optimizados','',f"Partidas: {len(observations)} de {expected}; mapas: {len(files)} de 40.",'','| Variante | Partidas | Ganadores | Rondas | Combates | Producidos | Gastados | Remontadas ronda 12 | Remontadas ronda 20 |','|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for r in summary:
    fmt=lambda p: f"{p['rate']*100:.1f}%" if p['rate'] is not None else '—'
    lines.append(f"| {r['variant']} | {r['played']} | {r['completed']} | {r['avg_rounds']} | {r['avg_combats']} | {r['avg_production']} | {r['avg_spending']} | {fmt(r['remontadas']['12'])} | {fmt(r['remontadas']['20'])} |")
pathlib.Path('hito5-logistics-40-consolidated.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
if len(observations)!=expected: raise SystemExit(f'INCOMPLETE {len(observations)}/{expected}')

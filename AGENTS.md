# Instrucciones para agentes (Codex, Claude, Antigravity…)

Proyecto: HorarioCESA, prototipo del Hackatón CESA. Ver `README.md` para el flujo y la arquitectura.

## Antes del primer commit (obligatorio)

Vercel está en el plan Hobby de Juan Esteban y **bloquea cualquier publicación cuyo commit no tenga a Juan Esteban como autor**. En cada computador, dentro de este repositorio, configura el autor una sola vez:

```bash
git config user.name "juanestebanmoncadac-cyber"
git config user.email "juanestebanmoncadac@gmail.com"
```

Verifica con `git config user.email` antes de hacer commit. Si ya hiciste un commit con otro autor y no lo has subido, corrígelo con `git commit --amend --reset-author --no-edit`.

## Reglas del repositorio

- Se trabaja directo en `main`; cada `git push` a `main` publica en https://horariocesa.vercel.app.
- Antes de subir, corre `npm test` y `npm run build`. No subas si alguno falla.
- Haz `git pull` antes de empezar y antes de subir, para no pisar el trabajo de otros.
- No cambies `src/types.ts` (contrato de datos) sin avisar al equipo: todos dependen de él.
- Respeta la carpeta de cada dueño (tabla "Estructura" del `README.md`). Si necesitas tocar la de otro, avísale.
- No subas `src/datos/pensum.json` ni `src/datos/oferta.json`: se generan con `npm run datos`.
- No agregues servidor, base de datos ni llaves de API sin acordarlo con el equipo: el motor corre en el navegador a propósito.
- Escribe los mensajes de commit en español, cortos y diciendo qué cambió.

# Nuestra Historia

Página personal con canciones, poemas, fotos y notas de amor. Guardado en la nube cuando se
abre dentro de Claude, y en el navegador (localStorage) cuando se abre como sitio local.

## Estructura

```
├── index.html          # Estructura HTML de la página
├── css/
│   └── style.css        # Todos los estilos
├── js/
│   └── script.js         # Toda la lógica e interactividad
├── images/
│   └── photo-01.jpg ...  # Fotos usadas en la sección "Fotos"
└── assets/
    └── README.md          # Reservado para fuentes/íconos/audio locales
```

## Cómo verlo

Abre `index.html` con **Live Server** (extensión de VS Code) o cualquier servidor local.
No lo abras con doble clic directo desde el explorador de archivos (`file://`): algunos
navegadores restringen las rutas relativas a `images/` en ese modo, así que un servidor
local evita ese problema.

## Notas

- Las tipografías (Fraunces y Manrope) se cargan desde Google Fonts, así que se necesita
  conexión a internet para verlas con el estilo correcto.
- El guardado de canciones, poemas, fotos y notas usa `window.storage` cuando la página
  corre dentro de un chat de Claude, y cae automáticamente a `localStorage` del navegador
  cuando se abre como sitio local — en ese segundo caso, los datos quedan solo en ese
  navegador/dispositivo, no se comparten entre quienes abran el archivo por su cuenta.

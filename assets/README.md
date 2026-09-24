# assets/

Carpeta reservada para recursos adicionales (fuentes locales, íconos, audio, etc.).

Actualmente el proyecto no usa nada de aquí porque las tipografías (Fraunces y Manrope)
se cargan desde Google Fonts en el `<head>` de `index.html`. Si en algún momento quieres
que el sitio funcione sin conexión a internet, puedes descargar esas fuentes como
archivos `.woff2`, guardarlas aquí, y declararlas con `@font-face` en `css/style.css`.

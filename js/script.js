/* ==========================================================================
   Nuestra Historia — Lógica e interactividad
   ========================================================================== */

const SHARED = true;
const LS_PREFIX = 'nuestra_historia_v1:';
let STORAGE_MODE = 'checking'; // 'cloud' | 'local' | 'none'

function lsKey(key, shared) { return LS_PREFIX + (shared ? 'shared:' : 'user:') + key; }
function lsGet(key, shared) {
  const v = localStorage.getItem(lsKey(key, shared));
  return v === null ? null : { key, value: v, shared };
}
function lsSet(key, value, shared) {
  localStorage.setItem(lsKey(key, shared), value);
  return { key, value, shared };
}

async function storageGet(key, shared) {
  if (STORAGE_MODE === 'cloud') {
    try { return await window.storage.get(key, shared); } catch (e) { return null; }
  }
  if (STORAGE_MODE === 'local') { return lsGet(key, shared); }
  return null;
}
async function storageSet(key, value, shared) {
  if (STORAGE_MODE === 'cloud') {
    try { return await window.storage.set(key, value, shared); } catch (e) { return null; }
  }
  if (STORAGE_MODE === 'local') { return lsSet(key, value, shared); }
  return null;
}

async function initStorageMode() {
  if (window.storage) {
    try {
      const testVal = 'ok-' + Date.now();
      await window.storage.set('meta:_check', testVal, true);
      const r = await window.storage.get('meta:_check', true);
      if (r && r.value === testVal) { STORAGE_MODE = 'cloud'; return; }
    } catch (e) { /* fall through */ }
  }
  try {
    localStorage.setItem('__ls_check__', '1');
    localStorage.removeItem('__ls_check__');
    STORAGE_MODE = 'local';
  } catch (e) {
    STORAGE_MODE = 'none';
  }
}
function showStorageWarning() {
  const b = document.getElementById('storageBanner');
  b.style.display = 'block';
  b.style.background = '#5a1f2b';
  b.style.color = '#f5d9de';
  b.innerHTML = '⚠️ El guardado automático no está activo en esta ventana. Prueba abrir la página en un navegador normal (no en modo privado) para que pueda guardar.';
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function getArr(key) {
  try {
    const r = await storageGet(key, SHARED);
    return r ? JSON.parse(r.value) : [];
  } catch (e) { return []; }
}
async function setVal(key, val) {
  try {
    const res = await storageSet(key, JSON.stringify(val), SHARED);
    if (!res) showStorageWarning();
  } catch (e) { console.error('storage error', e); showStorageWarning(); }
}

async function loadNames() {
  try {
    const r = await storageGet('meta:names', SHARED);
    if (r) {
      const { a, b } = JSON.parse(r.value);
      document.getElementById('heroNames').textContent = `${a} & ${b}`;
      document.getElementById('navBrand').textContent = `✦ ${a} & ${b}`;
      buildAuthorSelect(a, b);
      return { a, b };
    }
  } catch (e) { }
  document.getElementById('namesModal').style.display = 'flex';
  buildAuthorSelect('Yo', 'Él');
  return null;
}
function buildAuthorSelect(a, b) {
  const opts = `<option value="${esc(a)}">${esc(a)}</option><option value="${esc(b)}">${esc(b)}</option>`;
  document.getElementById('noteAuthor').innerHTML = opts;
}
async function openNamesModal() {
  try {
    const r = await storageGet('meta:names', SHARED);
    if (r) {
      const { a, b } = JSON.parse(r.value);
      document.getElementById('nameA').value = a || '';
      document.getElementById('nameB').value = b || '';
    }
  } catch (e) { }
  document.getElementById('namesModal').style.display = 'flex';
}
async function saveNames() {
  const a = document.getElementById('nameA').value.trim() || 'Yo';
  const b = document.getElementById('nameB').value.trim() || 'Él';
  await setVal('meta:names', { a, b });
  document.getElementById('heroNames').textContent = `${a} & ${b}`;
  document.getElementById('navBrand').textContent = `✦ ${a} & ${b}`;
  buildAuthorSelect(a, b);
  document.getElementById('namesModal').style.display = 'none';
  renderNotes();
}
document.getElementById('heroNames').addEventListener('click', () => {
  openNamesModal();
});

function openApodosEditModal() {
  document.getElementById('apodoEdit1').value = '';
  document.getElementById('apodoEdit2').value = '';
  const msg = document.getElementById('apodosEditMsg');
  msg.textContent = '';
  msg.style.color = 'var(--rose)';
  document.getElementById('apodosEditModal').style.display = 'flex';
}
function closeApodosEditModal() {
  document.getElementById('apodosEditModal').style.display = 'none';
}
async function saveApodosEdit() {
  const v1 = document.getElementById('apodoEdit1').value;
  const v2 = document.getElementById('apodoEdit2').value;
  const msg = document.getElementById('apodosEditMsg');
  if (!v1.trim() || !v2.trim()) { msg.textContent = 'Escribe los dos apodos.'; return; }
  await setVal('meta:access', { a: normalizeApodo(v1), b: normalizeApodo(v2) });
  msg.style.color = 'var(--gold-soft)';
  msg.textContent = '¡Listo! Los apodos quedaron actualizados.';
  setTimeout(closeApodosEditModal, 1200);
}

function getSpotifyEmbed(url) {
  if (!url) return null;
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/);
  return m ? { type: m[1], id: m[2] } : null;
}

async function renderSongs() {
  const list = await getArr('songs');
  const el = document.getElementById('songsList');
  if (!list.length) { el.innerHTML = '<div class="empty-state">Aún no hay canciones.</div>'; return; }
  el.innerHTML = list.slice().reverse().map(s => `
    <div class="song-card">
      <div class="song-title">${esc(s.title)}</div>
      ${s.artist ? `<div class="song-artist">${esc(s.artist)}</div>` : ''}
      ${s.spotifyId ? `
        <a class="song-play" href="https://open.spotify.com/${esc(s.spotifyType || 'track')}/${esc(s.spotifyId)}" target="_blank" rel="noopener">
          <span class="disc"></span>
          <span class="info"><span class="label">Escuchar en Spotify</span><span class="sub">Toca para abrir la canción</span></span>
          <span class="go">▶</span>
        </a>
      ` : ''}
      ${s.note ? `<div class="song-note">"${esc(s.note)}"</div>` : ''}
    </div>`).join('');
}
async function addSong(e) {
  e.preventDefault();
  const title = document.getElementById('songTitle').value.trim();
  if (!title) return false;
  const artist = document.getElementById('songArtist').value.trim();
  const note = document.getElementById('songNote').value.trim();
  const videoUrl = document.getElementById('songVideo').value.trim();
  const sp = getSpotifyEmbed(videoUrl);
  const list = await getArr('songs');
  list.push({ id: uid(), title, artist, note, spotifyId: sp ? sp.id : null, spotifyType: sp ? sp.type : null });
  await setVal('songs', list);
  e.target.reset();
  renderSongs();
  return false;
}

const SEED_SONGS = [
  { title: "Canela", artist: "Nanpa Básico & Charles Ans", spotifyId: "0YJpOnT2JgZ0z3Xmsc1w3h", spotifyType: "track", note: "Te la dedico porque tienes un sabor dulce y adictivo que se me quedó grabado en el alma. Me recuerda a ese amor sin afán, que se disfruta despacito pero con una intensidad enorme. Es para decirte que tu aroma, tu boca y tu forma de tratarme me atrapan por completo, y que no hay nada más rico que perder el tiempo entre tus brazos sintiendo que la vida a tu lado sabe a gloria." },
  { title: "Dibújame", artist: "Rich Vagos (Gera MX, Charles Ans, Samantha Barrón)", spotifyId: "6U4g013eRkWvAOf76949Qk", spotifyType: "track", note: "Te la dedico porque me fascina la forma en que me miras y cómo logras sacar la versión más bonita de mí. Es ese tipo de amor que inspira, que parece arte. Es mi forma de decirte que me encanta cómo encajamos, que contigo los días grises agarran color y que quiero que me sigas esculpiendo a besos, porque en tu vida y en tus planes es donde mejor me veo." },
  { title: "Confianza", artist: "Micro TDH", spotifyId: "4chzKVwJz3Dt0ryO3Vd9ue", spotifyType: "track", note: "Te la dedico porque contigo encontré una lealtad y una paz que no cambio por nada. No es solo que me encantes, es que a tu lado me siento en total libertad de ser yo, sin miedo a ser juzgada ni traicionada. Es para agradecerte la seguridad que me das, porque construir esto sobre una base tan sólida y sincera es lo que hace que te ame con la cabeza fría y el corazón encendido." },
  { title: "Quiéreme así", artist: "Nanpa Básico", spotifyId: "2f7cMkW2M9sJ2L9e3p2b0X", spotifyType: "track", note: "Te la dedico sin filtros ni pretensiones, para decirte que te amo con todo lo que soy: con mis virtudes, mis días difíciles y mi intensidad. Me recuerda a lo bonito que es que me abraces completa, tal cual soy, y a la promesa de que yo también te quiero así, transparente y real. Es mi manera de pedirte que nos sigamos eligiendo sin máscaras, queriéndonos bonito y apretado." },
  { title: "Soñé", artist: "Zoé", spotifyId: "1L9i1O33e5sU3L74gU4w8G", spotifyType: "track", note: "Te la dedico porque estar contigo se siente como estar en otro mundo. Tu amor es mi refugio, ese lugar tranquilo donde el caos de afuera desaparece y todo se vuelve paz. No necesito nada ostentoso ni ruidoso cuando estoy a tu lado; me basta con la magia etérea que creamos juntos y con sentir que vivir a tu lado es, literalmente, como un sueño del que jamás quisiera despertar." },
  { title: "Es por ti", artist: "Juanes", spotifyId: "1P6X7uW1qO2k9I2K33vX4b", spotifyType: "track", note: "Te dedico esta canción porque tu presencia en mi vida es luz pura. Llegaste a enseñarme lo que es sanar y sonreír de verdad, cambiándole el color a mis días más oscuros. Es mi forma de darte las gracias por ser mi calma, mi motivación y esa razón diaria que tengo para despertarme feliz; si hoy mi corazón está en paz, es verdaderamente por ti." },
  { title: "Tócame", artist: "La Santa Grifa", spotifyId: "7L08aC9zXmR5j6b9wM0wU1", spotifyType: "track", note: "Esta canción te la dedico sin filtros ni timidez, porque lo que me provocas es un fuego brutal que me quema por dentro. Es pura atracción, magnetismo y ganas incontrolables de tenerte pegado a mí. Me recuerda a esa química cruda y sin reservas donde sobran las palabras, porque lo único que quiero es encerrarme contigo, recorrer tu piel y perdernos juntos en lo nuestro." },
  { title: "Sábanas Blancas", artist: "La Santa Grifa", spotifyId: "5cR5Ea3pX0Yf6Rk0Z33mP1", spotifyType: "track", note: "Te la dedico porque me recuerda a nuestra intimidad a puerta cerrada, ese espacio privado donde el resto del mundo deja de existir. No es solo deseo, es esa complicidad única que se siente cuando nos entregamos por completo sin importar nada más. Es para decirte que me fascina el calor de tu cuerpo, la paz que me da quedarme entre tus brazos y las ganas constantes que tengo de volver a perdernos entre las sábanas." },
  { title: "Piel con piel", artist: "La Santa Grifa", spotifyId: "3YJvX013e8aK9O9wP1L5m2", spotifyType: "track", note: "Te dedico este tema porque describe a la perfección ese contacto físico tan intenso que tenemos. Me encanta cómo me erizas la piel con solo tocarme y la manera en que nos buscamos sin rodeos ni pretensiones. Es para confesarte que me mata la tentación de romper cualquier distancia entre los dos, sentir el calor de tu cuerpo pegado al mío y vivir esa pasión frente a frente, sin frenos." },
  { title: "Una loca como tú", artist: "Nanpa Básico", spotifyId: "2sL6wL6m02sU9R34uP1p8X", spotifyType: "track", note: "Te la dedico porque amo tu esencia tan única e intensa; me enamoró esa locura tuya que no encaja con nadie más pero que conmigo hace el engranaje perfecto. Contigo todo es transparente, real y divertido. Me encanta que celebremos quiénes somos sin caretas, porque entre tanto caos en el mundo, tú eres mi persona favorita y mi complicidad más bonita." },
  { title: "Love Me Again", artist: "John Newman", spotifyId: "2S2422A30S42R002S4A3W1", spotifyType: "track", note: "Te dedico esta canción por la fuerza desbordante y la intensidad que transmite. El amor real no es perfecto, pero estar contigo me da unas ganas gigantes de entregarlo todo, de aprender de los errores y de cuidarte con el alma. Es mi forma de decirte que, pase lo que pase o se ponga difícil el camino, mi deseo de luchar por lo nuestro y de volver a enamorarte nunca se va a apagar." },
  { title: "Te iré a buscar", artist: "Santa Fe Klan & Nanpa Básico", spotifyId: "5R40m6e23P4A2K1M31p8gX", spotifyType: "track", note: "Te la dedico como una promesa de lealtad absoluta. Me gusta porque es un amor de equipo, de cuidarnos la espalda en las buenas y en las malas. Es para decirte que no hay problema, distancia ni día difícil que me impida mover cielo y tierra con tal de llegar a ti, darte un abrazo y recordarte que aquí estoy y siempre voy a estar." },
  { title: "Cafuné", artist: "Micro TDH", spotifyId: "303W6xZ8L2uK3sW18e3pG1", spotifyType: "track", note: "Te dedico esta canción porque es la definición exacta de querer bonito, despacio y con el alma. Me recuerda a nuestros momentos a solas, cuando te acaricio el cabello, te contemplo en silencio y me doy cuenta de que no necesito nada más en la vida. Es mi forma más dulce de decirte que en tus brazos encontré mi hogar y que acurrucarme contigo es mi rincón favorito del universo." },
  { title: "Bésame sin sentir", artist: "Micro TDH", spotifyId: "1n39W6e8128K8P0w2e3P21", spotifyType: "track", note: "Te la dedico para confesarte lo mucho que me desarmaste. Al principio me daba miedo sentir algo tan fuerte y quise no engancharme tan rápido, pero bastó un acercamiento tuyo para que se me cayeran todas las defensas. Es mi manera de admitir que me ganaste por completo, que me fascina cómo me mueves el piso y que ya no quiero disimular lo mucho que me atrapaste." },
  { title: "Yo no sé qué me han hecho tus ojos", artist: "Julio Jaramillo", spotifyId: "39uA60ticfKtyfGeyzQ15Z", spotifyType: "track", note: "Te la dedico porque tus ojos tienen un hechizo del que ya no puedo ni quiero librarme. Es un clásico que transmite ese amor puro, romántico y antiguo, donde la mirada de la persona amada lo cambia todo por completo. Es mi forma de decirte que me pierdo en la forma en que me miras, que tus ojos iluminan mi vida y que desde que entraste en mi mundo, lograste atrapar mi corazón de una manera tan profunda que no encuentro explicación, solo sé que me tienes completamente enamorada." },
  { title: "Como Tú", artist: "Klibre & Zona Infame", spotifyId: "6DcDzBH7z03ct3wdKS2m9z", spotifyType: "track", note: "Te dedico esta canción porque habla de algo que siento mucho contigo: te quiero por quien eres, por tu forma de ser, por tu esencia, por todo eso que te hace ser tú. No quiero a alguien parecido a ti ni a alguien que tenga lo que tú tienes. Te quiero a ti, exactamente como eres. Y entre tantas personas, fue tu forma de ser la que hizo que mi corazón te eligiera." },
  { title: "Déjate Querer", artist: "La Santa Grifa", spotifyId: "0ZGklobMQKBTtfwcuYEGWE", spotifyType: "track", note: "Te dedico esta canción porque siento que describe demasiado bien lo que me pasa contigo. Me pasa eso de quedarme mirándote, emocionarme cuando estás cerca, sentir mariposas cuando me besas y perderme cuando estamos juntos. Me encanta tu forma de hacerme sentir, la conexión que tenemos y esa atracción que existe entre nosotros. Hay cosas que simplemente no se pueden explicar, solo sentir… y contigo me pasa todo eso. Así que sí, amor: déjate querer, porque yo quiero quererte muchísimo." }
];

async function seedSongsOnce() {
  const existing = await getArr('songs');
  const byTitle = new Map(SEED_SONGS.map(s => [s.title, s]));
  let changed = false;

  const updated = existing.map(song => {
    const seed = byTitle.get(song.title);
    if (seed && !song.spotifyId && seed.spotifyId) {
      changed = true;
      return { ...song, spotifyId: seed.spotifyId, spotifyType: seed.spotifyType || 'track' };
    }
    return song;
  });

  const existingTitles = new Set(existing.map(s => s.title));
  const missing = SEED_SONGS.filter(s => !existingTitles.has(s.title));
  const newOnes = missing.map(s => ({ id: uid(), title: s.title, artist: s.artist, note: s.note, spotifyId: s.spotifyId || null, spotifyType: s.spotifyType || null }));
  if (newOnes.length) changed = true;

  if (changed) await setVal('songs', updated.concat(newOnes));
}

const SEED_POEMS = [
  {
    title: "Tu Mirada", featured: false, text: `Tu mirada me envuelve,
pero no puedo sostenerla,
porque en su brillo hay un fuego
que desnuda mis pensamientos.
Mi vista se desvía hacia tus labios,
curvas delicadas que me cautivan,
dibujos de deseo en silencio,
promesas que no se pronuncian,
pero que laten entre nosotros.

Regreso a tus ojos,
y me pierdo en su profundidad,
un laberinto de café que me hipnotiza,
me envuelve en su calidez,
como un amanecer que respira sobre mi piel.
Allí encuentro paz y vértigo a la vez,
una dulce condena, una invitación al abismo,
donde el alma se rinde sin temor.

Tu mirada me envuelve,
y aunque intento resistirla, no puedo.
Porque en ella vive algo que me llama,
una historia que no ha sido contada,
y en el temblor de ese instante,
entiendo que a veces mirar
también es una forma de amar.`},

  {
    title: "Primer Beso", featured: false, text: `Bajo el abrigo espeso de aquel árbol, donde la sombra dibujaba nuestro secreto, el tiempo decidió detener su marcha. Tanto tiempo ha pasado y la memoria sigue intacta, guardando en el pecho el eco de ese instante único, imposible de borrar, mientras la nostalgia me abraza al recordar.
Él quería besarme y mi alma entera lo exigía. Mis ojos no podían apartarse de su rostro, con el deseo ardiente de rozar sus labios: carnosos, suavemente rosas, una tentación latiendo a pocos centímetros de mí. El miedo me congelaba en un susurro, un impulso de negarme por el temor a ser descubiertos, pero el deseo fue más fuerte que cualquier prudencia. Decidí ceder. Me dejé besar.
Y en el segundo en que sus labios tocaron los míos, el mundo exterior se apagó por completo. Fue la primera vez que sentí su calor tan tridimensional, tan cerca, una marejada de chispas recorriendo cada rincón de mi piel. Una locura dulce y electrizante me empezó a consumir por dentro, encendiendo un fuego que jamás había conocido.
En ese instante eterno, contenida en su abrazo, solo pude rogarle al universo que jamás terminara aquello que apenas comenzaba a florecer.`},

  {
    title: "¿Exagerada?", featured: false, text: `Un susurro no alcanza para nombrarte,
necesitas mil mares, tres planetas,
un trueno que retumbe en el cometa
y un sol que no termine de abrasarte.

No te basta decir que el cielo es grande,
dices que es un océano colosal;
no lloras una gota de tristeza,
inundas el universo en un caudal.
Palabra que te vistes de gigante,
que pintas con un pincel de diez metros,
donde cabe un segundo pones siglos
y un paso lo convertís en un kilómetro.

Te llaman desmedida, sin freno ni recato,
pero en un mundo a veces tan chiquito,
tu voz es el alivio que nos demuestra
que el drama también puede ser infinito.`},

  {
    title: "Déjame Ser Tu Espada, Tu Casca", featured: false, text: `Elige mi sombra entre toda la bruma,
mírame a mí cuando el mundo se apague,
sé la única luz que mi fe consuma,
el único acero que mi pecho indague.

No quiero la gloria de un trono lejano,
ni el eco constante de miles de voces,
sólo el refugio sagrado de tu mano
en medio de un siglo de fieras y atroces.

Quiero ser tu Casca, la que lucha al frente,
tu espada firme en la noche más fría,
la que no retrocede ante la corriente,
tu refugio leal, tu sola compañía.

Escógeme a mí, que no busco otra suerte
que sangrar tu marcha o velar tu descanso,
ser tu compañera más allá de la muerte,
tu tormenta firme y tu puerto de remanso.

No me dejes varada en la fría penumbra,
siente este pulso que a ti te reclama;
que si en tu horizonte una sola luz alumbra,
sea esta devoción que por tu amor se inflama.`},

  {
    title: "…", featured: false, text: `En las grietas de esta piel que aún conserva tus huellas,
me pregunto en silencio por qué jamás fui la elegida,
por qué tu amor mudó de rumbo como un viento helado
y dejó la casa de mi pecho desierta y dividida.

¿Acaso ese pulso tuyo no puede volver a cambiar?
¿No puedes mirar mis ruinas y volver a amarme,
aunque sea a tu manera, áspera y distante,
pero con una grieta de luz donde pueda quedarme?

Dame la prueba, la sombra de un gesto que me sostenga,
mira que este amor no encuentra refugio en otro pecho;
no me abandones aquí, tirada en este mundo helado,
donde te juro esperar con las rodillas contra el suelo.

Te jure amar con marcas evidentes en la piel y en el alma,
cicatrices abiertas que gritan que no necesito a nadie más;
mírame mendigar la limosna de tu mirada,
porque perderte a ti es no volver a existir jamás.`},

  {
    title: "…", featured: false, text: `Cierra las puertas, apaga el ruido allá afuera:
ignora al mundo y mírame a mí,
mira a esta chica que se descompone y muere por ti,
que ya no sabe existirse si no es a tu lado.

Fíjate en mí, pero rompe esta piel,
no te quedes en este cuerpo mundano y gastado;
mira este amor encendido, esta alma terca
que entregaría hasta su último aliento por ti.

Fíjate en estos ojos que un día dijiste amar,
estos mismos ojos que hoy no paran de mirarte
y de ahogarse en llanto por este amor infinito
que me quema por dentro y no sabe apagarse.

Mira este cabello rizado, enredado y espeso,
imperfecto y denso como mi amor sincero por ti,
un nudo de angustia que nadie más puede desatarse.

Mira este corazón sangrante, abierto y tuyo,
que no quiere a nadie más en este universo:
mírame a mí, solo a mí, y no me dejes morir aquí.`},

  {
    title: "Suicido De Amor", featured: false, text: `He de morir esperando tu amor.
Mi suicidio es esperarte,
esperar que me elijas una vez más,
aunque sé que quizá nunca vuelvas,
aunque cada día que pasa
tu ausencia me enseñe a vivir con el vacío.
Duele.

Claro que duele.
Duele quererte cuando no sé si me quieres,
duele pronunciar tu nombre
cuando el silencio es la única respuesta que recibo.
Pero ¿qué importa el dolor
cuando el corazón ya decidió dónde quedarse?
Porque quiero que seas tú.
Quiero ser egoísta,
aunque el amor debería ser libertad.
Quiero tu amor para mí,
quiero tus manos, tu voz, tus noches,
quiero volver a sentir que entre tantas personas
tú todavía puedes encontrarme.
Quiero luchar por este amor que siento por ti,
aunque a veces parezca que estoy luchando solo,
aunque mis esperanzas sean apenas cenizas
de algo que alguna vez ardió entre nosotros.
No quiero rendirme contigo.
No sé cuándo terminará mi vida,
no sé cuántos amaneceres me quedan,
ni cuántas noches tendré que atravesar
antes de que el destino decida por nosotros.
Pero hay algo que sí sé:
quiero vivirlos contigo.
Quiero vivir los días en que me quieras
y también sobrevivir los días en que no lo hagas.
Quiero conocer todas tus versiones,
incluso aquellas que jamás me pertenecerán.
Y si esperarte significa pasar años
con el corazón sentado frente a una puerta cerrada,
esperaré.
No porque quiera desaparecer por ti,
sino porque hay amores que se sienten como una muerte lenta:
te quitan el sueño,
te roban el orgullo,
te dejan hablando con recuerdos
y abrazando fantasmas.
Y aun así, uno permanece.
Ese será mi juramento:
no morir por ti,
sino morir lentamente a cada versión de mí
que aprendió a vivir sin tu amor.
Porque si algún día regreso a ti,
quiero hacerlo con todo lo que fui,
con todas mis heridas,
con todas las noches que te esperé
y con cada lágrima que cayó en silencio
mientras pronunciaba tu nombre.
Y si nunca vuelves...
entonces cargaré contigo
como se carga una canción triste,
como se guarda una fotografía
de alguien que ya no está,
como se guarda en el pecho
el último latido de un amor imposible.
Mi suicidio de amor no será quitarme la vida.
Será entregarte el último pedazo de mi corazón
sabiendo que quizá nunca volverás a sostenerlo.
Y aun así...
te esperaré.`},

  {
    title: "Devorarte", featured: false, text: `Mi egoísmo quiere devorarte por completo—masticar tu carne, tus huesos y tu sangre hasta que nada de ti exista fuera de mí.
Te quiero encerrado dentro de una jaula dorada, lo suficientemente cerca como para poder perderme en tus ojos mientras atravieso cada una de tus capas—
de piel, nervios, pensamientos, hasta conocer cada parte temblorosa de tu mente.
No solo quiero tenerte.
Quiero consumirte tan completamente que no quede ningún lugar donde puedas existir excepto debajo de mi piel.`}
];

async function seedPoemsOnce() {
  const existing = await getArr('poems');
  const today = new Date().toISOString().slice(0, 10);
  if (existing.length) {
    let changed = false;
    let updated = existing;
    if (existing.some(p => p.featured)) {
      updated = updated.map(p => ({ ...p, featured: false }));
      changed = true;
    }
    const existingTitles = new Set(updated.map(p => p.title));
    const missing = SEED_POEMS.filter(p => !existingTitles.has(p.title));
    if (missing.length) {
      updated = updated.concat(missing.map(p => ({ id: uid(), title: p.title, text: p.text, date: today, featured: false })));
      changed = true;
    }
    if (changed) await setVal('poems', updated);
    return;
  }
  const seeded = SEED_POEMS.map(p => ({ id: uid(), title: p.title, text: p.text, date: today, featured: false }));
  await setVal('poems', seeded);
}

async function renderPoems() {
  const list = await getArr('poems');
  const el = document.getElementById('poemsList');
  const featuredEl = document.getElementById('poemFeatured');
  if (featuredEl) featuredEl.innerHTML = '';
  if (!list.length) { el.innerHTML = '<div class="empty-state">Todavía no has guardado ningún poema.</div>'; return; }
  const pinned = list.filter(p => p.title === 'Suicido De Amor');
  const rest = list.filter(p => p.title !== 'Suicido De Amor').slice().reverse();
  const ordered = pinned.concat(rest);
  el.innerHTML = ordered.map(p => `
    <div class="poem-card">
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.text)}</p>
    </div>`).join('');
}
async function addPoem(e) {
  e.preventDefault();
  const title = document.getElementById('poemTitle').value.trim();
  const text = document.getElementById('poemText').value.trim();
  if (!title || !text) return false;
  const list = await getArr('poems');
  list.push({ id: uid(), title, text, date: new Date().toISOString().slice(0, 10), featured: false });
  await setVal('poems', list);
  e.target.reset();
  renderPoems();
  return false;
}

const SEED_PHOTOS = [
  { id: "seed-photo-1", url: "images/photo-01.jpg" },
  { id: "seed-photo-2", url: "images/photo-02.jpg" },
  { id: "seed-photo-3", url: "images/photo-03.jpg" },
  { id: "seed-photo-4", url: "images/photo-04.jpg" },
  { id: "seed-photo-5", url: "images/photo-05.jpg" },
  { id: "seed-photo-6", url: "images/photo-06.jpg" },
  { id: "seed-photo-7", url: "images/photo-07.jpg" },
  { id: "seed-photo-8", url: "images/photo-08.jpg" },
  { id: "seed-photo-9", url: "images/photo-09.jpg" },
  { id: "seed-photo-10", url: "images/photo-10.jpg" },
  { id: "seed-photo-11", url: "images/photo-11.jpg" },
  { id: "seed-photo-12", url: "images/photo-12.jpg" },
  { id: "seed-photo-13", url: "images/photo-13.jpg" },
  { id: "seed-photo-14", url: "images/photo-14.jpg" },
  { id: "seed-photo-15", url: "images/photo-15.jpg" },
  { id: "seed-photo-16", url: "images/photo-16.jpg" },
  { id: "seed-photo-17", url: "images/photo-17.jpg" },
  { id: "seed-photo-18", url: "images/photo-18.jpg" },
  { id: "seed-photo-19", url: "images/photo-19.jpg" },
  { id: "seed-photo-20", url: "images/photo-20.jpg" },
  { id: "seed-photo-21", url: "images/photo-21.jpg" },
  { id: "seed-photo-22", url: "images/photo-22.jpg" },
  { id: "seed-photo-23", url: "images/photo-23.jpg" },
  { id: "seed-photo-24", url: "images/photo-24.jpg" },
  { id: "seed-photo-25", url: "images/photo-25.jpg" },
  { id: "seed-photo-26", url: "images/photo-26.jpg" },
  { id: "seed-photo-27", url: "images/photo-27.jpg" },
  { id: "seed-photo-28", url: "images/photo-28.jpg" },
  { id: "seed-photo-29", url: "images/photo-29.jpg" },
  { id: "seed-photo-30", url: "images/photo-30.jpg" },
  { id: "seed-photo-31", url: "images/photo-31.jpg" },
  { id: "seed-photo-32", url: "images/photo-32.jpg" },
  { id: "seed-photo-33", url: "images/photo-33.jpg" },
  { id: "seed-photo-34", url: "images/photo-34.jpg" },
  { id: "seed-photo-35", url: "images/photo-35.jpg" },
  { id: "seed-photo-36", url: "images/photo-36.jpg" },
  { id: "seed-photo-37", url: "images/photo-37.jpg" },
  { id: "seed-photo-38", url: "images/photo-38.jpg" }
];

async function seedPhotosOnce() {
  const existing = await getArr('photos');
  const existingIds = new Set(existing.map(p => p.id));
  const missing = SEED_PHOTOS.filter(p => !existingIds.has(p.id));
  if (!missing.length) return;
  await setVal('photos', existing.concat(missing));
}

async function renderPhotos() {
  const list = await getArr('photos');
  const el = document.getElementById('photosList');
  if (!list.length) { el.innerHTML = '<div class="empty-state">Aún no hay fotos.</div>'; return; }
  el.innerHTML = list.slice().reverse().map(p => `
    <div class="photo-card">
      <img src="${esc(p.url)}" alt="" onerror="this.style.display='none'">
    </div>`).join('');
}
async function addPhoto(e) {
  e.preventDefault();
  const url = document.getElementById('photoUrl').value.trim();
  if (!url) return false;
  const list = await getArr('photos');
  list.push({ id: uid(), url });
  await setVal('photos', list);
  e.target.reset();
  renderPhotos();
  return false;
}

async function renderNotes() {
  const list = await getArr('notes');
  const el = document.getElementById('notesList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">Aún no se han escrito notas. Sé el primero.</div>';
  } else {
    el.innerHTML = list.slice().reverse().map(n => {
      const d = new Date(n.ts);
      return `<div class="note-card" data-id="${n.id}">
        <button class="edit-btn" onclick="startEditNote('${n.id}')" title="Editar nota">✎ editar</button>
        <div class="author">${esc(n.author)}</div>
        <p class="text">${esc(n.text)}</p>
        <div class="date">${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}${n.editedAt ? ' · editada' : ''}</div>
      </div>`;
    }).join('');
  }
}
function startEditNote(id) {
  const card = document.querySelector(`.note-card[data-id="${id}"]`);
  if (!card) return;
  const textEl = card.querySelector('.text');
  const currentText = textEl.textContent;
  card.querySelector('.edit-btn').style.display = 'none';
  const dateEl = card.querySelector('.date');
  textEl.outerHTML = `<textarea class="edit-textarea">${esc(currentText)}</textarea>
    <div class="edit-actions">
      <button class="save-btn" onclick="saveEditNote('${id}')">Guardar</button>
      <button class="cancel-btn" onclick="renderNotes()">Cancelar</button>
    </div>`;
  if (dateEl) dateEl.style.display = 'none';
}
async function saveEditNote(id) {
  const card = document.querySelector(`.note-card[data-id="${id}"]`);
  const newText = card.querySelector('.edit-textarea').value.trim();
  if (!newText) return;
  const list = await getArr('notes');
  const idx = list.findIndex(n => n.id === id);
  if (idx === -1) return;
  list[idx].text = newText;
  list[idx].editedAt = Date.now();
  await setVal('notes', list);
  renderNotes();
}
async function addNote(e) {
  e.preventDefault();
  const author = document.getElementById('noteAuthor').value;
  const text = document.getElementById('noteText').value.trim();
  if (!text) return false;
  const list = await getArr('notes');
  list.push({ id: uid(), author, text, ts: Date.now() });
  await setVal('notes', list);
  document.getElementById('noteText').value = '';
  renderNotes();
  return false;
}
document.getElementById('noteAuthor').addEventListener('change', renderNotes);

const SEED_REASON_TEXTS = `
Porque eres tú.
Porque me haces sentir especial.
Porque contigo puedo ser yo misma.
Porque conocerte cambió muchas cosas en mi vida.
Porque tienes una forma única de ver el mundo.
Porque tu personalidad me encanta.
Porque admiro quién eres.
Porque tienes un corazón enorme.
Porque eres auténtico.
Porque no necesitas fingir para gustarme.
Porque me gusta tu manera de pensar.
Porque admiro tus sueños.
Porque me gusta escucharte hablar de lo que te apasiona.
Porque tienes una esencia que no encuentro en nadie más.
Porque eres diferente.
Porque me encanta descubrir nuevas cosas de ti.
Porque siempre hay algo nuevo que aprender sobre ti.
Porque me gusta la persona que eres cuando estás conmigo.
Porque tienes una manera especial de hacer las cosas.
Porque eres parte de mi mundo favorito.
Porque haces que los días normales tengan algo especial.
Porque me encanta tu forma de expresarte.
Porque tienes una personalidad que me atrapa.
Porque me haces querer conocerte cada día más.
Porque eres una persona que quiero conservar en mi vida.
Porque contigo siento tranquilidad.
Porque me haces sentir querida.
Porque me haces sentir importante.
Porque me haces sentir acompañada.
Porque contigo me siento segura.
Porque haces que mi corazón se acelere.
Porque consigues sacarme una sonrisa incluso en días difíciles.
Porque me haces sentir afortunada.
Porque contigo puedo olvidar por un rato mis problemas.
Porque haces que extrañarte sea bonito.
Porque cuando pienso en ti sonrío sin darme cuenta.
Porque haces que mi mundo se sienta un poquito más bonito.
Porque contigo siento que estoy en casa.
Porque tus palabras pueden cambiar mi día.
Porque un mensaje tuyo puede alegrarme muchísimo.
Porque me haces sentir escuchada.
Porque me haces sentir comprendida.
Porque me haces sentir importante para alguien.
Porque contigo puedo bajar la guardia.
Porque haces que mi corazón se sienta tranquilo.
Porque me das motivos para sonreír.
Porque haces que quiera abrazarte incluso cuando estás lejos.
Porque me haces sentir mariposas.
Porque haces que espere con ilusión nuestros encuentros.
Porque simplemente me haces feliz.
Porque me encanta tu sonrisa.
Porque me encanta tu mirada.
Porque adoro tus abrazos.
Porque tus besos tienen algo que no puedo explicar.
Porque me encanta cuando me miras.
Porque me gusta cuando sonríes por algo que dije.
Porque adoro cuando me buscas para darme un beso.
Porque me encantan nuestras conversaciones.
Porque me gustan tus mensajes.
Porque me gusta cuando me preguntas cómo estoy.
Porque me gusta cuando te preocupas por mí.
Porque me encanta escucharte reír.
Porque me gusta cuando dices mi nombre.
Porque me gusta cómo suena tu voz.
Porque me encanta cuando me abrazas sin decir nada.
Porque me gustan tus pequeñas ocurrencias.
Porque me encantan tus gestos.
Porque me gusta cuando intentas hacerme reír.
Porque adoro nuestros momentos de silencio.
Porque incluso tus pequeños detalles significan muchísimo para mí.
Porque recuerdas cosas que yo misma olvido.
Porque me gusta cuando me sorprendes.
Porque adoro cuando me escribes sin que lo espere.
Porque me gusta cuando quieres compartir algo conmigo.
Porque tus detalles hacen que me enamore un poquito más.
Porque me gustan nuestras caminatas.
Porque me encantan nuestras conversaciones largas.
Porque adoro cuando perdemos la noción del tiempo juntos.
Porque me gustan nuestros momentos espontáneos.
Porque cada salida contigo termina siendo un recuerdo.
Porque me gustan nuestras fotos.
Porque me gusta recordar cómo nos conocimos.
Porque adoro recordar nuestro primer beso.
Porque me gusta recordar nuestro primer "te amo".
Porque nuestros recuerdos tienen un lugar especial en mi corazón.
Porque contigo hasta hacer nada puede ser divertido.
Porque me gustan nuestras bromas internas.
Porque tenemos cosas que solo nosotros entendemos.
Porque me encanta cuando recordamos algo y nos reímos.
Porque tenemos nuestra propia historia.
Porque hemos creado recuerdos que nadie puede reemplazar.
Porque me encanta pensar en todo lo que hemos vivido.
Porque todavía tenemos muchísimos recuerdos por crear.
Porque cada momento contigo se siente diferente.
Porque me gusta nuestra manera de pasar el tiempo.
Porque adoro nuestras pequeñas aventuras.
Porque me gusta cuando improvisamos planes.
Porque me encanta cuando un día cualquiera termina siendo especial.
Porque nuestros recuerdos me hacen sonreír.
Porque quiero seguir llenando mi memoria de momentos contigo.
Porque me gusta cómo somos juntos.
Porque somos un equipo.
Porque puedo confiar en ti.
Porque me gusta compartir mi vida contigo.
Porque puedo contarte mis cosas.
Porque puedo hablar contigo de cualquier tema.
Porque me escuchas.
Porque puedo escucharte.
Porque me gusta que podamos aprender juntos.
Porque me gusta crecer a tu lado.
Porque me gusta que tengamos nuestros propios códigos.
Porque tenemos nuestra manera de querernos.
Porque me gusta cómo nos cuidamos.
Porque me gusta cuando hacemos planes juntos.
Porque me gusta imaginar aventuras contigo.
Porque contigo puedo hablar de mis sueños.
Porque puedo contarte mis miedos.
Porque puedo compartir mis alegrías.
Porque también puedo compartir mis días malos.
Porque no necesito aparentar estar bien todo el tiempo contigo.
Porque me gusta sentir que estamos del mismo lado.
Porque contigo puedo celebrar mis pequeños logros.
Porque puedo confiarte mis pensamientos.
Porque me gusta que seas una persona a la que quiero contarle todo.
Porque nuestra relación significa muchísimo para mí.
Porque sabes hacerme reír.
Porque tenemos un humor que solo nosotros entendemos.
Porque me haces reír cuando menos lo espero.
Porque adoro nuestras estupideces.
Porque contigo puedo ser ridícula sin vergüenza.
Porque me encanta cuando hacemos el tonto juntos.
Porque tus ocurrencias me encantan.
Porque me haces olvidar la seriedad por un rato.
Porque nuestras conversaciones pueden pasar de profundas a absurdas en segundos.
Porque tenemos chistes que nadie más entiende.
Porque me encanta molestarte.
Porque me encanta cuando me molestas.
Porque sabes cómo sacarme una sonrisa.
Porque nuestras risas son uno de mis sonidos favoritos.
Porque contigo nunca sé qué tontería vamos a terminar haciendo.
Porque haces que los momentos aburridos sean divertidos.
Porque me encanta tu sentido del humor.
Porque me haces reír hasta cuando quiero estar seria.
Porque contigo puedo ser una niña otra vez.
Porque nuestras risas se quedan en mi memoria.
Porque haces que un día malo pueda terminar bien.
Porque me encanta reír contigo.
Porque me gusta cuando intentas hacerme reír.
Porque adoro nuestras caras tontas.
Porque contigo nunca me falta una razón para sonreír.
Porque me gusta cuando me escribes buenos días.
Porque me encanta recibir un "¿ya llegaste?".
Porque me gusta cuando preguntas si comí.
Porque adoro cuando me dices que me extrañas.
Porque me encanta cuando me cuentas cómo fue tu día.
Porque me gusta cuando compartes una canción conmigo.
Porque me gusta cuando me mandas una foto.
Porque adoro cuando me cuentas algo que te recordó a mí.
Porque me gusta cuando me haces un cumplido inesperado.
Porque me gusta cuando buscas cualquier excusa para hablar conmigo.
Porque me gusta cuando me preguntas qué estoy haciendo.
Porque adoro nuestros mensajes largos.
Porque me gustan nuestros audios.
Porque me gusta escucharte aunque estés hablando de cualquier cosa.
Porque adoro cuando me dices "te amo".
Porque nunca me cansa escucharlo de ti.
Porque me gusta decirte que te amo.
Porque cada "te amo" sigue teniendo significado.
Porque me gustan nuestros apodos.
Porque me encanta tener un lugar especial en tu vida.
Porque me gusta cuando me haces sentir recordada.
Porque me gustan tus pequeños gestos de cariño.
Porque incluso un mensaje corto tuyo puede alegrarme.
Porque tus detalles nunca pasan desapercibidos.
Porque haces especial lo pequeño.
Porque admiro tu esfuerzo.
Porque admiro tus ganas de salir adelante.
Porque admiro tus sueños.
Porque admiro cuando persigues lo que quieres.
Porque admiro tu forma de enfrentar los problemas.
Porque admiro las cosas que has aprendido.
Porque admiro todo lo que has conseguido.
Porque me gusta verte crecer.
Porque me gusta verte cumplir metas.
Porque quiero estar ahí para celebrarlas contigo.
Porque me gusta cuando no te rindes.
Porque admiro tu manera de cuidar lo que te importa.
Porque me gusta verte apasionado por algo.
Porque admiro tus talentos.
Porque me encanta descubrir lo bueno que hay en ti.
Porque tienes cualidades que me inspiran.
Porque me haces querer ser mejor.
Porque me motivas sin siquiera intentarlo.
Porque admiro tu forma de aprender.
Porque admiro tus esfuerzos silenciosos.
Porque sé que detrás de muchas cosas hay trabajo que no siempre veo.
Porque me gusta apoyarte.
Porque me gusta verte avanzar.
Porque me emociona imaginar todo lo que puedes lograr.
Porque estoy orgullosa de ti.
Porque eres a quien quiero contarle las cosas.
Porque eres mi lugar favorito para compartir.
Porque eres una de mis personas favoritas.
Porque ocupas un espacio enorme en mi corazón.
Porque pienso en ti durante el día.
Porque muchas cosas me recuerdan a ti.
Porque cuando veo algo bonito quiero enseñártelo.
Porque cuando escucho una canción pienso en ti.
Porque cuando me pasa algo quiero contártelo.
Porque cuando estoy feliz quiero compartirlo contigo.
Porque cuando estoy triste quiero un abrazo tuyo.
Porque me gusta buscarte.
Porque me gusta encontrarte.
Porque me gusta esperarte.
Porque me gusta verte.
Porque me gusta despedirme sabiendo que volveremos a vernos.
Porque siempre quiero cinco minutos más contigo.
Porque el tiempo contigo pasa demasiado rápido.
Porque siempre me quedo con ganas de más momentos.
Porque me haces falta cuando no estás.
Porque me gusta tenerte cerca.
Porque me gusta saber que estás ahí.
Porque tu presencia cambia mis días.
Porque me gusta compartir mi mundo contigo.
Porque quiero conocer también el tuyo.
Porque quiero vivir muchas cosas contigo.
Porque quiero conocer lugares contigo.
Porque quiero tomar miles de fotos a tu lado.
Porque quiero tener nuevas historias que contar.
Porque quiero descubrir restaurantes contigo.
Porque quiero ver películas contigo.
Porque quiero viajar contigo.
Porque quiero caminar por lugares desconocidos contigo.
Porque quiero ver amaneceres contigo.
Porque quiero ver atardeceres contigo.
Porque quiero conocer tus lugares favoritos.
Porque quiero mostrarte los míos.
Porque quiero celebrar más cumpleaños contigo.
Porque quiero celebrar más aniversarios.
Porque quiero seguir escribiéndote cartas.
Porque quiero seguir sorprendiéndote.
Porque quiero seguir aprendiendo de ti.
Porque quiero seguir conociéndote.
Porque quiero crear nuevas tradiciones.
Porque quiero llenar otro álbum contigo.
Porque quiero tener nuevas canciones nuestras.
Porque quiero sumar nuevos recuerdos.
Porque quiero seguir riéndome contigo.
Porque quiero seguir abrazándote.
Porque quiero ver hasta dónde nos lleva nuestra historia.
Porque simplemente pasa.
Porque mi corazón te eligió.
Porque contigo se siente diferente.
Porque no sé cómo explicarlo, pero lo siento.
Porque hay algo en ti que me atrae.
Porque tienes una magia difícil de describir.
Porque contigo todo parece tener otro significado.
Porque haces que quiera quedarme.
Porque no necesito una razón complicada para quererte.
Porque te quiero incluso en los días normales.
Porque te quiero cuando estamos arreglados y cuando estamos despeinados.
Porque te quiero cuando estás feliz.
Porque te quiero cuando estás cansado.
Porque te quiero en tus días buenos.
Porque también quiero acompañarte en los difíciles.
Porque no necesito que seas perfecto.
Porque me gusta que seas humano.
Porque tus imperfecciones también forman parte de ti.
Porque no quiero una versión inventada de ti.
Porque quiero conocerte tal como eres.
Porque me gusta tu forma de ser.
Porque me gusta tu forma de querer.
Porque me gusta cómo haces espacio para mí.
Porque contigo el amor se siente cercano.
Porque eres tú, y eso me basta.
Porque me gusta abrazarte fuerte.
Porque me encanta caminar contigo.
Porque me gusta sentarme a tu lado.
Porque me encanta cuando nuestras manos se encuentran.
Porque me gusta cuando me acercas hacia ti.
Porque me encanta quedarme mirándote.
Porque me gusta observarte sin que te des cuenta.
Porque adoro tu forma de sonreír.
Porque me gusta cuando estás concentrado.
Porque me encanta cuando te emocionas.
Porque me gusta escucharte hablar de tus intereses.
Porque me encanta cuando algo te hace ilusión.
Porque quiero ser parte de tus momentos felices.
Porque me gusta celebrar contigo.
Porque me gusta consentirte.
Porque me gusta cuidarte.
Porque me gusta preguntarte cómo estás.
Porque me importa cómo te sientes.
Porque me importan tus sueños.
Porque me importan tus preocupaciones.
Porque me importan tus pequeñas victorias.
Porque me importa tu felicidad.
Porque quiero verte sonreír.
Porque quiero ser una razón más para esa sonrisa.
Porque me haces querer cuidar nuestro amor.
Porque me encanta nuestra complicidad.
Porque tenemos recuerdos que solo nosotros entendemos.
Porque me gusta nuestra manera de hablarnos.
Porque me encantan nuestros apodos.
Porque me gustan nuestras conversaciones nocturnas.
Porque adoro cuando hablamos hasta quedarnos sin tema.
Porque me gusta cuando terminamos hablando de cualquier cosa.
Porque me gusta cuando me cuentas tus historias.
Porque me gusta contarte las mías.
Porque me gusta saber qué pasa por tu cabeza.
Porque me gusta que conozcas mis pensamientos.
Porque me haces sentir escuchada.
Porque me haces sentir importante.
Porque me gusta confiar en ti.
Porque me gusta que confíes en mí.
Porque quiero ser alguien en quien puedas apoyarte.
Porque quiero estar para ti.
Porque me gusta poder ayudarte.
Porque me gusta que podamos aprender de nuestros errores.
Porque me gusta que sigamos adelante juntos.
Porque me gusta que nuestra historia siga creciendo.
Porque todavía me emocionan nuestros encuentros.
Porque todavía me pongo nerviosa contigo.
Porque todavía siento mariposas.
Porque todavía me encanta verte.
Porque todavía me encanta abrazarte.
Porque todavía quiero darte muchos besos.
Porque todavía encuentro nuevas razones para quererte.
Porque cada día descubro algo nuevo de ti.
Porque haces que el amor tenga pequeños detalles.
Porque me gusta cómo me miras.
Porque me gusta cómo me abrazas.
Porque me gusta cómo me cuidas.
Porque me gusta cómo me escuchas.
Porque me gusta cómo me haces reír.
Porque me gusta cómo me acompañas.
Porque me gusta cómo me conoces.
Porque me gusta cómo respetas mi forma de ser.
Porque me gusta cómo puedo ser yo contigo.
Porque me gusta que tengamos nuestra propia historia.
Porque quiero seguir escribiendo capítulos contigo.
Porque quiero que tengamos más historias que recordar.
Porque quiero llenar más páginas contigo.
Porque quiero seguir guardando fotos nuestras.
Porque quiero seguir encontrando canciones que nos representen.
Porque quiero seguir escribiéndote poemas.
Porque quiero seguir sorprendiéndote.
Porque quiero seguir celebrándote.
Porque quiero seguir diciéndote cuánto te amo.
Porque quiero seguir escuchándote decirlo.
Porque quiero seguir aprendiendo a amarte.
Porque quiero seguir conociendo tus versiones.
Porque quiero estar cuando cumplas tus sueños.
Porque quiero verte alcanzar tus metas.
Porque quiero acompañarte en tus aventuras.
Porque quiero compartir contigo los días buenos.
Porque quiero abrazarte en los días malos.
Porque quiero seguir riendo contigo.
Porque quiero seguir creando recuerdos.
Porque quiero seguir eligiéndote cada día.
Porque entre tantas personas, tuve la suerte de encontrarte.
Porque nuestra historia es una de mis historias favoritas.
Porque mi vida es más bonita desde que estás en ella.
Porque todavía me quedan muchísimas cosas por vivir contigo.
Porque después de 365 razones, todavía no encuentro una forma suficiente de explicar cuánto te amo.
`.trim().split('\n');
const SEED_REASONS = SEED_REASON_TEXTS.map((text, index) => ({ id: `reason-${index + 1}`, text }));

async function seedReasonsOnce() {
  const existing = await getArr('reasons');
  const synchronized = SEED_REASONS.map((reason, index) => ({
    ...reason,
    id: existing[index]?.id || uid()
  }));
  const isDifferent = existing.length !== synchronized.length || existing.some((reason, index) =>
    reason.text !== synchronized[index].text
  );
  if (isDifferent) await setVal('reasons', synchronized);
}

async function renderReasons() {
  const list = await getArr('reasons');
  const el = document.getElementById('reasonsList');
  const count = document.getElementById('reasonCount');
  count.textContent = `${list.length} razones`;
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">Todavía no hay razones guardadas.</div>';
    return;
  }
  el.innerHTML = list.map((reason, index) => `
    <div class="reason-card">
      <span class="reason-number">${index + 1}</span>
      <p class="reason-text">${esc(reason.text)}</p>
    </div>`).join('');
}
async function deleteItem(key, id) {
  const list = await getArr(key);
  await setVal(key, list.filter(x => x.id !== id));
  const map = { songs: renderSongs, poems: renderPoems, photos: renderPhotos, reasons: renderReasons };
  map[key] && map[key]();
}

function openPoemsModal() {
  document.getElementById('poemasModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePoemsModal() {
  document.getElementById('poemasModal').classList.remove('open');
  document.body.style.overflow = '';
}
function openCancionesModal() {
  document.getElementById('cancionesModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCancionesModal() {
  document.getElementById('cancionesModal').classList.remove('open');
  document.body.style.overflow = '';
}
function openFotosModal() {
  document.getElementById('fotosModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeFotosModal() {
  document.getElementById('fotosModal').classList.remove('open');
  document.body.style.overflow = '';
}
function openReasonsModal() {
  document.getElementById('razonesModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeReasonsModal() {
  document.getElementById('razonesModal').classList.remove('open');
  document.body.style.overflow = '';
}

const SECRET_MESSAGES = {
  'te-lobo': {
    phrase: 'Te lobo 🐺🌱',
    title: '¿Por qué te lobo? 🐺🌱',
    message: `Porque no es un error.

Te amo como come la bestia en el barro,
sin pedir permiso, a mordiscos, de un jalón.
No hay rosas ni seda en este garfio,
solo hambre pura metida en el pulmón.

"Te lobo". Te arranco la carne de los días,
te trago entero con piel y con espina.
Eres mi presa, mi sangre, mi manía,
la sombra feroz que en la noche me domina.

Esto no es ternura de cuento ni de cuna,
es diente, es garra, es hueso crujiendo.
Un aullido sucio tirado a la luna,
mientras te devoro y me voy consumiendo.

Te lobo, mi amor no te olvida:
en cada día, cada momento, minuto y segundo,
por el resto de esta vida ferina,
hasta el último aliento, voy a amarte. `

  },
  'esperare': {
    phrase: 'Esperaré 🌱',
    title: '¿Por qué esperaría? 🌱',
    message: `Porque si eres tú, siempre valdrá la pena esperar.
Esperaré por cada abrazo, cada beso y cada momento contigo.
Esperaré por ti.`
  }
};

function createSecretSpark(trigger) {
  const rect = trigger.getBoundingClientRect();
  const spark = document.createElement('span');
  spark.className = 'secret-spark';
  spark.textContent = Math.random() > .5 ? '♥' : '✦';
  spark.style.left = `${rect.left + rect.width / 2}px`;
  spark.style.top = `${rect.top + rect.height / 2}px`;
  spark.style.setProperty('--x', `${Math.round((Math.random() - .5) * 90)}px`);
  spark.style.setProperty('--y', `${Math.round(-25 - Math.random() * 55)}px`);
  document.body.appendChild(spark);
  spark.addEventListener('animationend', () => spark.remove(), { once: true });
}

function openSecretModal(secretId) {
  const secret = SECRET_MESSAGES[secretId];
  if (!secret) return;
  document.getElementById('secretModalTitle').textContent = secret.title;
  document.getElementById('secretModalMessage').textContent = secret.message;
  document.getElementById('secretModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSecretModal() {
  document.getElementById('secretModal').classList.remove('open');
  document.body.style.overflow = '';
}
function openDrawingModal() {
  document.getElementById('drawingModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawingModal() {
  document.getElementById('drawingModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.querySelectorAll('.secret-trigger[data-secret-id]').forEach(trigger => {
  trigger.addEventListener('click', () => {
    if (trigger.classList.contains('is-awakening')) return;
    trigger.classList.add('is-awakening');
    Array.from({ length: 5 }, () => createSecretSpark(trigger));
    setTimeout(() => {
      trigger.classList.remove('is-awakening');
      if (trigger.dataset.secretId === 'nuestro-dibujo') openDrawingModal();
      else openSecretModal(trigger.dataset.secretId);
    }, 700);
  });
});
document.querySelectorAll('.secret-trigger[data-atlas-page]').forEach(trigger => {
  trigger.addEventListener('click', () => {
    window.location.href = trigger.dataset.atlasPage;
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closePoemsModal(); closeCancionesModal(); closeFotosModal(); closeReasonsModal(); closeSecretModal(); closeDrawingModal(); }
});

const navButtons = document.querySelectorAll('nav button[data-target]');
navButtons.forEach(btn => btn.addEventListener('click', () => {
  if (btn.dataset.target === 'poemas') { openPoemsModal(); return; }
  if (btn.dataset.target === 'canciones') { openCancionesModal(); return; }
  if (btn.dataset.target === 'fotos') { openFotosModal(); return; }
  if (btn.dataset.target === 'razones') { openReasonsModal(); return; }
  document.getElementById(btn.dataset.target).scrollIntoView({ behavior: 'smooth' });
}));
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navButtons.forEach(b => b.classList.toggle('active', b.dataset.target === entry.target.id));
    }
  });
}, { rootMargin: '-40% 0px -50% 0px' });
document.querySelectorAll('section').forEach(s => io.observe(s));

function initStars() {
  const c = document.getElementById('stars');
  const ctx = c.getContext('2d');
  let stars = [];
  function resize() {
    c.width = window.innerWidth; c.height = window.innerHeight;
    stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: Math.random() * 1.3 + 0.2, a: Math.random(), speed: Math.random() * 0.008 + 0.002
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      s.a += s.speed;
      const alpha = 0.35 + Math.sin(s.a) * 0.35;
      ctx.beginPath();
      ctx.fillStyle = `rgba(227,201,138,${Math.max(0, alpha)})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize(); draw();
}

function normalizeApodo(s) { return (s || '').trim().toLowerCase(); }

async function loadAccess() {
  try {
    const r = await storageGet('meta:access', SHARED);
    return r ? JSON.parse(r.value) : null;
  } catch (e) { return null; }
}

function renderGateSetup() {
  document.getElementById('accessSubtitle').textContent = 'Aún no hay apodos guardados. Escojan los dos apodos que van a usar para entrar de ahora en adelante.';
  document.getElementById('accessInput1').placeholder = 'Crea el primer apodo';
  document.getElementById('accessInput2').placeholder = 'Crea el segundo apodo';
  document.querySelector('.access-card button.btn-gold').textContent = 'Guardar y entrar';
  document.querySelector('.access-card button.btn-gold').onclick = handleAccessSetupSubmit;
}
function renderGateLogin() {
  document.getElementById('accessSubtitle').textContent = 'Escribe nuestros apodos para entrar.';
  document.getElementById('accessInput1').placeholder = 'Apodo 1';
  document.getElementById('accessInput2').placeholder = 'Apodo 2';
  document.querySelector('.access-card button.btn-gold').textContent = 'Entrar';
  document.querySelector('.access-card button.btn-gold').onclick = handleAccessLoginSubmit;
}

async function handleAccessSetupSubmit() {
  const v1 = document.getElementById('accessInput1').value;
  const v2 = document.getElementById('accessInput2').value;
  const err = document.getElementById('accessError');
  if (!v1.trim() || !v2.trim()) { err.textContent = 'Escribe los dos apodos.'; return; }
  await setVal('meta:access', { a: normalizeApodo(v1), b: normalizeApodo(v2) });
  err.textContent = '';
  await unlockApp();
}
async function handleAccessLoginSubmit() {
  const v1 = normalizeApodo(document.getElementById('accessInput1').value);
  const v2 = normalizeApodo(document.getElementById('accessInput2').value);
  const err = document.getElementById('accessError');
  const access = await loadAccess();
  if (!access) { err.textContent = 'Algo salió mal, recarga la página.'; return; }
  const match = (v1 === access.a && v2 === access.b) || (v1 === access.b && v2 === access.a);
  if (match) { err.textContent = ''; await unlockApp(); }
  else { err.textContent = 'Esos apodos no son correctos. Intenta de nuevo.'; }
}
function handleAccessSubmit() {
  document.querySelector('.access-card button.btn-gold').onclick();
}
document.getElementById('accessInput2').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAccessSubmit();
});
document.getElementById('accessInput1').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('accessInput2').focus();
});

async function unlockApp() {
  document.getElementById('accessGate').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  await startApp();
}

async function startApp() {
  await loadNames();
  await seedSongsOnce();
  renderSongs();
  await seedPoemsOnce();
  renderPoems();
  await seedPhotosOnce();
  renderPhotos();
  await seedReasonsOnce();
  renderReasons();
  renderNotes();
}

(async function boot() {
  initStars();
  await initStorageMode();
  if (STORAGE_MODE === 'none') showStorageWarning();
  const access = await loadAccess();
  if (access) renderGateLogin();
  else renderGateSetup();
})();

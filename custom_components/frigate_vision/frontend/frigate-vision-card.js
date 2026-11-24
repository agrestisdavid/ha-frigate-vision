const CARD_VERSION = "0.5.0";

const VALID_LIVE_PROVIDERS = ["auto", "go2rtc", "mjpeg", "off"];
const VALID_GO2RTC_MODES = ["webrtc", "mse", "mp4", "hls", "mjpeg"];
const DEFAULT_GO2RTC_MODES = "webrtc,mse,mp4,hls,mjpeg";

function sanitizeGo2rtcModes(modes) {
  if (typeof modes !== "string") return null;
  const tokens = modes
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = tokens.filter((t) => VALID_GO2RTC_MODES.includes(t));
  return valid.length ? valid.join(",") : null;
}

const STRINGS = {
  de: {
    title: "Frigate Zeitachse",
    loading_events: "Lade Events…",
    loading_clip: "Lade Clip…",
    no_events: "Keine Events gefunden.",
    load_more: "Mehr laden",
    load_less: "Weniger",
    refresh: "Neu laden",
    close: "Schließen",
    select_to_play: "Wähle einen Event, um den Clip abzuspielen",
    no_description: "– keine Beschreibung –",
    clip_no_recording: "Für dieses Event ist in Frigate kein Clip verfügbar (keine Aufnahme für dieses Zeitfenster).",
    all_labels: "Alle Labels",
    all_cameras: "Alle Kameras",
    labels_plural: "Labels",
    cameras_plural: "Kameras",
    filter_today: "Heute",
    filter_yesterday: "Gestern",
    filter_week: "Letzte 7 Tage",
    filter_all: "Alle",
    today: "Heute",
    yesterday: "Gestern",
    live: "Live",
    live_connecting: "Verbinde…",
    live_failed: "Livestream fehlgeschlagen",
    live_no_camera: "Keine Kamera für Liveansicht verfügbar",
    talk: {
      toggle: "Antippen zum Sprechen", hold: "Zum Sprechen gedrückt halten",
      pending: "Mikrofon wird verbunden …", sending: "Mikrofon sendet", stop: "Sprechen beenden",
      denied: "Mikrofonzugriff verweigert. Prüfe die Browserberechtigung.",
      micUnavailable: "Mikrofon nicht verfügbar. Prüfe Eingabegerät und sicheren Zugriff (HTTPS oder localhost).",
      noChannel: "Dieser Stream hat keinen kompatiblen Audiorückkanal.",
      unmapped: "Home Assistant kann den Stream dieser Kamera nicht eindeutig zuordnen.",
      haUnavailable: "Gegensprechen benötigt eine authentifizierte Home-Assistant-Verbindung.",
      requiresWebRTC: "Gegensprechen benötigt eine aktive WebRTC-Wiedergabe.",
      disconnected: "Verbindung unterbrochen. Das Mikrofon ist aus.",
      connectionFailed: "Der Audiorückkanal konnte nicht verbunden werden.",
    },
    doorbell: { incoming: "Es klingelt", silenced: "Eingehender Anruf (Klingelton stumm)", answer: "Annehmen", decline: "Anruf ablehnen", fullscreen: "Vollbild öffnen", exitFullscreen: "Vollbild verlassen", listen: "Kameraton einschalten", listenBlocked: "Kameraton ist stumm. Tippe auf „Kameraton einschalten“.", mute: "Mikrofon stummschalten", unmute: "Mikrofon wieder einschalten", muted: "Mikrofon stumm", cancel: "Abbrechen", end: "Beenden", replies: "Schnellantworten", loadingReplies: "Schnellantworten werden geladen …", repliesUnavailable: "Schnellantworten nicht verfügbar.", playing: "Ansage wird gesendet …", failed: "Ansage konnte nicht gesendet werden.", dismiss: "Schließen" },
    doorbellAudio: { speaker: "Kameraton", mute: "Kameraton stummschalten", start: "Sprechen starten" },
    ptz: { label: "PTZ-Steuerung", up: "Nach oben", down: "Nach unten", left: "Nach links", right: "Nach rechts", stop: "Stopp", failed: "PTZ-Befehl fehlgeschlagen. Verbindung und Berechtigung prüfen." },
    timeline_loading: "Lade Aufnahme…",
    timeline_no_recording: "Keine Aufnahme für diesen Zeitraum",
    timeline_no_camera: "Keine Kamera für Timeline verfügbar",
    timeline_failed: "Aufnahme konnte nicht geladen werden",
    timeline_zoom_in: "Hineinzoomen",
    timeline_zoom_out: "Herauszoomen",
  },
  en: {
    title: "Frigate Timeline",
    loading_events: "Loading events…",
    loading_clip: "Loading clip…",
    no_events: "No events found.",
    load_more: "Load more",
    load_less: "Less",
    refresh: "Refresh",
    close: "Close",
    select_to_play: "Select an event to play the clip",
    no_description: "– no description –",
    clip_no_recording: "No clip available in Frigate for this event (no recording for this time range).",
    all_labels: "All labels",
    all_cameras: "All cameras",
    labels_plural: "labels",
    cameras_plural: "cameras",
    filter_today: "Today",
    filter_yesterday: "Yesterday",
    filter_week: "Past 7 days",
    filter_all: "All",
    today: "Today",
    yesterday: "Yesterday",
    live: "Live",
    live_connecting: "Connecting…",
    live_failed: "Live stream failed",
    live_no_camera: "No camera available for live view",
    talk: {
      toggle: "Tap to talk", hold: "Hold to talk", pending: "Connecting microphone…",
      sending: "Microphone on air", stop: "Stop talking",
      denied: "Microphone access denied. Check your browser permission.",
      micUnavailable: "Microphone unavailable. Check the input device and use HTTPS or localhost.",
      noChannel: "This stream has no compatible audio backchannel.",
      unmapped: "Home Assistant could not verify that this stream belongs to this camera.",
      haUnavailable: "Talk requires an authenticated Home Assistant connection.",
      requiresWebRTC: "Talk requires active WebRTC playback.",
      disconnected: "Connection lost. The microphone is off.",
      connectionFailed: "Could not connect the audio backchannel.",
    },
    doorbell: { incoming: "Doorbell ringing", silenced: "Incoming call (ringtone muted)", answer: "Answer", decline: "Decline call", fullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen", listen: "Enable camera sound", listenBlocked: "Camera sound is off. Select “Enable camera sound”.", mute: "Mute microphone", unmute: "Unmute microphone", muted: "Microphone muted", cancel: "Cancel", end: "End", replies: "Quick replies", loadingReplies: "Loading quick replies…", repliesUnavailable: "Quick replies are unavailable.", playing: "Sending announcement…", failed: "Could not send the announcement.", dismiss: "Close" },
    doorbellAudio: { speaker: "Camera sound", mute: "Mute camera sound", start: "Start talking" },
    ptz: { label: "PTZ controls", up: "Tilt up", down: "Tilt down", left: "Pan left", right: "Pan right", stop: "Stop", failed: "PTZ command failed. Check the connection and permissions." },
    timeline_loading: "Loading recording…",
    timeline_no_recording: "No recording for this period",
    timeline_no_camera: "No camera available for timeline",
    timeline_failed: "Could not load recording",
    timeline_zoom_in: "Zoom in",
    timeline_zoom_out: "Zoom out",
  },
  fr: {
    title: "Chronologie Frigate",
    loading_events: "Chargement des événements…",
    loading_clip: "Chargement du clip…",
    no_events: "Aucun événement trouvé.",
    load_more: "Charger plus",
    load_less: "Moins",
    refresh: "Actualiser",
    close: "Fermer",
    select_to_play: "Sélectionnez un événement pour lire le clip",
    no_description: "– aucune description –",
    clip_no_recording: "Aucun clip disponible dans Frigate pour cet événement (aucun enregistrement pour cette période).",
    all_labels: "Toutes les étiquettes",
    all_cameras: "Toutes les caméras",
    labels_plural: "étiquettes",
    cameras_plural: "caméras",
    filter_today: "Aujourd'hui",
    filter_yesterday: "Hier",
    filter_week: "7 derniers jours",
    filter_all: "Tous",
    today: "Aujourd'hui",
    yesterday: "Hier",
    live: "En direct",
    live_connecting: "Connexion…",
    live_failed: "Échec du flux en direct",
    live_no_camera: "Aucune caméra disponible pour la vue en direct",
    ptz: { label: "Commandes PTZ", up: "Monter", down: "Descendre", left: "Tourner à gauche", right: "Tourner à droite", stop: "Arrêter", failed: "Échec de la commande PTZ. Vérifiez la connexion et les autorisations." },
    timeline_loading: "Chargement de l'enregistrement…",
    timeline_no_recording: "Aucun enregistrement pour cette période",
    timeline_no_camera: "Aucune caméra disponible pour la chronologie",
    timeline_failed: "Impossible de charger l'enregistrement",
    timeline_zoom_in: "Zoom avant",
    timeline_zoom_out: "Zoom arrière",
  },
  es: {
    title: "Cronología de Frigate",
    loading_events: "Cargando eventos…",
    loading_clip: "Cargando clip…",
    no_events: "No se encontraron eventos.",
    load_more: "Cargar más",
    load_less: "Menos",
    refresh: "Actualizar",
    close: "Cerrar",
    select_to_play: "Selecciona un evento para reproducir el clip",
    no_description: "– sin descripción –",
    clip_no_recording: "No hay clip disponible en Frigate para este evento (no hay grabación para este intervalo).",
    all_labels: "Todas las etiquetas",
    all_cameras: "Todas las cámaras",
    labels_plural: "etiquetas",
    cameras_plural: "cámaras",
    filter_today: "Hoy",
    filter_yesterday: "Ayer",
    filter_week: "Últimos 7 días",
    filter_all: "Todo",
    today: "Hoy",
    yesterday: "Ayer",
    live: "En vivo",
    live_connecting: "Conectando…",
    live_failed: "Error en la transmisión en vivo",
    live_no_camera: "No hay cámara disponible para la vista en vivo",
    ptz: { label: "Controles PTZ", up: "Arriba", down: "Abajo", left: "Izquierda", right: "Derecha", stop: "Detener", failed: "Falló el comando PTZ. Comprueba la conexión y los permisos." },
    timeline_loading: "Cargando grabación…",
    timeline_no_recording: "No hay grabación para este período",
    timeline_no_camera: "No hay cámara disponible para la cronología",
    timeline_failed: "No se pudo cargar la grabación",
    timeline_zoom_in: "Acercar",
    timeline_zoom_out: "Alejar",
  },
  da: {
    title: "Frigate-tidslinje",
    loading_events: "Indlæser hændelser…",
    loading_clip: "Indlæser klip…",
    no_events: "Ingen hændelser fundet.",
    load_more: "Indlæs flere",
    load_less: "Færre",
    refresh: "Opdater",
    close: "Luk",
    select_to_play: "Vælg en hændelse for at afspille klippet",
    no_description: "– ingen beskrivelse –",
    clip_no_recording: "Intet klip tilgængeligt i Frigate for denne hændelse (ingen optagelse for dette tidsrum).",
    all_labels: "Alle etiketter",
    all_cameras: "Alle kameraer",
    labels_plural: "etiketter",
    cameras_plural: "kameraer",
    filter_today: "I dag",
    filter_yesterday: "I går",
    filter_week: "Seneste 7 dage",
    filter_all: "Alle",
    today: "I dag",
    yesterday: "I går",
    live: "Live",
    live_connecting: "Forbinder…",
    live_failed: "Livestream mislykkedes",
    live_no_camera: "Intet kamera tilgængeligt til livevisning",
    ptz: { label: "PTZ-styring", up: "Op", down: "Ned", left: "Venstre", right: "Højre", stop: "Stop", failed: "PTZ-kommandoen mislykkedes. Kontrollér forbindelse og tilladelser." },
    timeline_loading: "Indlæser optagelse…",
    timeline_no_recording: "Ingen optagelse for denne periode",
    timeline_no_camera: "Intet kamera tilgængeligt til tidslinjen",
    timeline_failed: "Kunne ikke indlæse optagelsen",
    timeline_zoom_in: "Zoom ind",
    timeline_zoom_out: "Zoom ud",
  },
  nl: {
    title: "Frigate-tijdlijn",
    loading_events: "Gebeurtenissen laden…",
    loading_clip: "Clip laden…",
    no_events: "Geen gebeurtenissen gevonden.",
    load_more: "Meer laden",
    load_less: "Minder",
    refresh: "Vernieuwen",
    close: "Sluiten",
    select_to_play: "Selecteer een gebeurtenis om de clip af te spelen",
    no_description: "– geen beschrijving –",
    clip_no_recording: "Geen clip beschikbaar in Frigate voor deze gebeurtenis (geen opname voor dit tijdvak).",
    all_labels: "Alle labels",
    all_cameras: "Alle camera's",
    labels_plural: "labels",
    cameras_plural: "camera's",
    filter_today: "Vandaag",
    filter_yesterday: "Gisteren",
    filter_week: "Laatste 7 dagen",
    filter_all: "Alles",
    today: "Vandaag",
    yesterday: "Gisteren",
    live: "Live",
    live_connecting: "Verbinden…",
    live_failed: "Livestream mislukt",
    live_no_camera: "Geen camera beschikbaar voor liveweergave",
    ptz: { label: "PTZ-bediening", up: "Omhoog", down: "Omlaag", left: "Links", right: "Rechts", stop: "Stoppen", failed: "PTZ-opdracht mislukt. Controleer de verbinding en machtigingen." },
    timeline_loading: "Opname laden…",
    timeline_no_recording: "Geen opname voor deze periode",
    timeline_no_camera: "Geen camera beschikbaar voor tijdlijn",
    timeline_failed: "Kon opname niet laden",
    timeline_zoom_in: "Inzoomen",
    timeline_zoom_out: "Uitzoomen",
  },
  sv: {
    title: "Frigate-tidslinje",
    loading_events: "Läser in händelser…",
    loading_clip: "Läser in klipp…",
    no_events: "Inga händelser hittades.",
    load_more: "Läs in fler",
    load_less: "Färre",
    refresh: "Uppdatera",
    close: "Stäng",
    select_to_play: "Välj en händelse för att spela upp klippet",
    no_description: "– ingen beskrivning –",
    clip_no_recording: "Inget klipp tillgängligt i Frigate för denna händelse (ingen inspelning för detta tidsintervall).",
    all_labels: "Alla etiketter",
    all_cameras: "Alla kameror",
    labels_plural: "etiketter",
    cameras_plural: "kameror",
    filter_today: "Idag",
    filter_yesterday: "Igår",
    filter_week: "Senaste 7 dagarna",
    filter_all: "Alla",
    today: "Idag",
    yesterday: "Igår",
    live: "Live",
    live_connecting: "Ansluter…",
    live_failed: "Liveströmmen misslyckades",
    live_no_camera: "Ingen kamera tillgänglig för livevisning",
    ptz: { label: "PTZ-styrning", up: "Upp", down: "Ned", left: "Vänster", right: "Höger", stop: "Stopp", failed: "PTZ-kommandot misslyckades. Kontrollera anslutning och behörigheter." },
    timeline_loading: "Läser in inspelning…",
    timeline_no_recording: "Ingen inspelning för denna period",
    timeline_no_camera: "Ingen kamera tillgänglig för tidslinjen",
    timeline_failed: "Kunde inte läsa in inspelningen",
    timeline_zoom_in: "Zooma in",
    timeline_zoom_out: "Zooma ut",
  },
  no: {
    title: "Frigate-tidslinje",
    loading_events: "Laster hendelser…",
    loading_clip: "Laster klipp…",
    no_events: "Ingen hendelser funnet.",
    load_more: "Last inn flere",
    load_less: "Færre",
    refresh: "Oppdater",
    close: "Lukk",
    select_to_play: "Velg en hendelse for å spille av klippet",
    no_description: "– ingen beskrivelse –",
    clip_no_recording: "Ingen klipp tilgjengelig i Frigate for denne hendelsen (ingen opptak for dette tidsrommet).",
    all_labels: "Alle etiketter",
    all_cameras: "Alle kameraer",
    labels_plural: "etiketter",
    cameras_plural: "kameraer",
    filter_today: "I dag",
    filter_yesterday: "I går",
    filter_week: "Siste 7 dager",
    filter_all: "Alle",
    today: "I dag",
    yesterday: "I går",
    live: "Live",
    live_connecting: "Kobler til…",
    live_failed: "Direktesending mislyktes",
    live_no_camera: "Ingen kamera tilgjengelig for livevisning",
    ptz: { label: "PTZ-styring", up: "Opp", down: "Ned", left: "Venstre", right: "Høyre", stop: "Stopp", failed: "PTZ-kommandoen mislyktes. Sjekk tilkoblingen og tillatelsene." },
    timeline_loading: "Laster opptak…",
    timeline_no_recording: "Ingen opptak for denne perioden",
    timeline_no_camera: "Ingen kamera tilgjengelig for tidslinjen",
    timeline_failed: "Kunne ikke laste inn opptaket",
    timeline_zoom_in: "Zoom inn",
    timeline_zoom_out: "Zoom ut",
  },
  fi: {
    title: "Frigate-aikajana",
    loading_events: "Ladataan tapahtumia…",
    loading_clip: "Ladataan leikettä…",
    no_events: "Tapahtumia ei löytynyt.",
    load_more: "Lataa lisää",
    load_less: "Vähemmän",
    refresh: "Päivitä",
    close: "Sulje",
    select_to_play: "Valitse tapahtuma toistaaksesi leikkeen",
    no_description: "– ei kuvausta –",
    clip_no_recording: "Frigatessa ei ole leikettä tälle tapahtumalle (ei tallennetta tälle aikavälille).",
    all_labels: "Kaikki tunnisteet",
    all_cameras: "Kaikki kamerat",
    labels_plural: "tunnisteet",
    cameras_plural: "kamerat",
    filter_today: "Tänään",
    filter_yesterday: "Eilen",
    filter_week: "Viimeiset 7 päivää",
    filter_all: "Kaikki",
    today: "Tänään",
    yesterday: "Eilen",
    live: "Live",
    live_connecting: "Yhdistetään…",
    live_failed: "Live-lähetys epäonnistui",
    live_no_camera: "Kameraa ei ole saatavilla live-näkymään",
    ptz: { label: "PTZ-ohjaus", up: "Ylös", down: "Alas", left: "Vasemmalle", right: "Oikealle", stop: "Pysäytä", failed: "PTZ-komento epäonnistui. Tarkista yhteys ja käyttöoikeudet." },
    timeline_loading: "Ladataan tallennetta…",
    timeline_no_recording: "Ei tallennetta tälle ajanjaksolle",
    timeline_no_camera: "Kameraa ei ole saatavilla aikajanalle",
    timeline_failed: "Tallennetta ei voitu ladata",
    timeline_zoom_in: "Lähennä",
    timeline_zoom_out: "Loitonna",
  },
  pl: {
    title: "Oś czasu Frigate",
    loading_events: "Ładowanie zdarzeń…",
    loading_clip: "Ładowanie klipu…",
    no_events: "Nie znaleziono zdarzeń.",
    load_more: "Załaduj więcej",
    load_less: "Mniej",
    refresh: "Odśwież",
    close: "Zamknij",
    select_to_play: "Wybierz zdarzenie, aby odtworzyć klip",
    no_description: "– brak opisu –",
    clip_no_recording: "Brak klipu w Frigate dla tego zdarzenia (brak nagrania dla tego zakresu czasu).",
    all_labels: "Wszystkie etykiety",
    all_cameras: "Wszystkie kamery",
    labels_plural: "etykiety",
    cameras_plural: "kamery",
    filter_today: "Dzisiaj",
    filter_yesterday: "Wczoraj",
    filter_week: "Ostatnie 7 dni",
    filter_all: "Wszystko",
    today: "Dzisiaj",
    yesterday: "Wczoraj",
    live: "Na żywo",
    live_connecting: "Łączenie…",
    live_failed: "Transmisja na żywo nie powiodła się",
    live_no_camera: "Brak kamery dostępnej dla widoku na żywo",
    ptz: { label: "Sterowanie PTZ", up: "W górę", down: "W dół", left: "W lewo", right: "W prawo", stop: "Zatrzymaj", failed: "Polecenie PTZ nie powiodło się. Sprawdź połączenie i uprawnienia." },
    timeline_loading: "Ładowanie nagrania…",
    timeline_no_recording: "Brak nagrania dla tego okresu",
    timeline_no_camera: "Brak kamery dostępnej dla osi czasu",
    timeline_failed: "Nie można załadować nagrania",
    timeline_zoom_in: "Powiększ",
    timeline_zoom_out: "Pomniejsz",
  },
  sr: {
    title: "Frigate vremenska linija",
    loading_events: "Učitavanje događaja…",
    loading_clip: "Učitavanje klipa…",
    no_events: "Nema pronađenih događaja.",
    load_more: "Učitaj više",
    load_less: "Manje",
    refresh: "Osveži",
    close: "Zatvori",
    select_to_play: "Izaberite događaj za reprodukciju klipa",
    no_description: "– nema opisa –",
    clip_no_recording: "Nema dostupnog klipa u Frigate-u za ovaj događaj (nema snimka za ovaj vremenski opseg).",
    all_labels: "Sve oznake",
    all_cameras: "Sve kamere",
    labels_plural: "oznake",
    cameras_plural: "kamere",
    filter_today: "Danas",
    filter_yesterday: "Juče",
    filter_week: "Poslednjih 7 dana",
    filter_all: "Sve",
    today: "Danas",
    yesterday: "Juče",
    live: "Uživo",
    live_connecting: "Povezivanje…",
    live_failed: "Prenos uživo nije uspeo",
    live_no_camera: "Nema kamere dostupne za prikaz uživo",
    ptz: { label: "PTZ kontrole", up: "Gore", down: "Dole", left: "Levo", right: "Desno", stop: "Zaustavi", failed: "PTZ komanda nije uspela. Proverite vezu i dozvole." },
    timeline_loading: "Učitavanje snimka…",
    timeline_no_recording: "Nema snimka za ovaj period",
    timeline_no_camera: "Nema kamere dostupne za vremensku liniju",
    timeline_failed: "Snimak nije moguće učitati",
    timeline_zoom_in: "Uvećaj",
    timeline_zoom_out: "Umanji",
  },
  ru: {
    title: "Хронология Frigate",
    loading_events: "Загрузка событий…",
    loading_clip: "Загрузка клипа…",
    no_events: "События не найдены.",
    load_more: "Загрузить еще",
    load_less: "Меньше",
    refresh: "Обновить",
    close: "Закрыть",
    select_to_play: "Выберите событие, чтобы воспроизвести клип",
    no_description: "– нет описания –",
    clip_no_recording: "В Frigate нет клипа для этого события (нет записи за этот промежуток времени).",
    all_labels: "Все метки",
    all_cameras: "Все камеры",
    labels_plural: "метки",
    cameras_plural: "камеры",
    filter_today: "Сегодня",
    filter_yesterday: "Вчера",
    filter_week: "Последние 7 дней",
    filter_all: "Все",
    today: "Сегодня",
    yesterday: "Вчера",
    live: "Прямой эфир",
    live_connecting: "Подключение…",
    live_failed: "Не удалось запустить прямой эфир",
    live_no_camera: "Нет камеры для просмотра в реальном времени",
    ptz: { label: "Управление PTZ", up: "Вверх", down: "Вниз", left: "Влево", right: "Вправо", stop: "Стоп", failed: "Не удалось выполнить команду PTZ. Проверьте соединение и права доступа." },
    timeline_loading: "Загрузка записи…",
    timeline_no_recording: "Нет записи за этот период",
    timeline_no_camera: "Нет камеры для хронологии",
    timeline_failed: "Не удалось загрузить запись",
    timeline_zoom_in: "Увеличить",
    timeline_zoom_out: "Уменьшить",
  },
  tr: {
    title: "Frigate Zaman Çizelgesi",
    loading_events: "Olaylar yükleniyor…",
    loading_clip: "Klip yükleniyor…",
    no_events: "Olay bulunamadı.",
    load_more: "Daha fazla yükle",
    load_less: "Daha az",
    refresh: "Yenile",
    close: "Kapat",
    select_to_play: "Klibi oynatmak için bir olay seçin",
    no_description: "– açıklama yok –",
    clip_no_recording: "Bu olay için Frigate'te klip yok (bu zaman aralığı için kayıt yok).",
    all_labels: "Tüm etiketler",
    all_cameras: "Tüm kameralar",
    labels_plural: "etiketler",
    cameras_plural: "kameralar",
    filter_today: "Bugün",
    filter_yesterday: "Dün",
    filter_week: "Son 7 gün",
    filter_all: "Tümü",
    today: "Bugün",
    yesterday: "Dün",
    live: "Canlı",
    live_connecting: "Bağlanıyor…",
    live_failed: "Canlı yayın başarısız oldu",
    live_no_camera: "Canlı görünüm için kamera yok",
    ptz: { label: "PTZ denetimleri", up: "Yukarı", down: "Aşağı", left: "Sola", right: "Sağa", stop: "Durdur", failed: "PTZ komutu başarısız. Bağlantıyı ve izinleri kontrol edin." },
    timeline_loading: "Kayıt yükleniyor…",
    timeline_no_recording: "Bu dönem için kayıt yok",
    timeline_no_camera: "Zaman çizelgesi için kamera yok",
    timeline_failed: "Kayıt yüklenemedi",
    timeline_zoom_in: "Yakınlaştır",
    timeline_zoom_out: "Uzaklaştır",
  },
  el: {
    title: "Χρονολόγιο Frigate",
    loading_events: "Φόρτωση συμβάντων…",
    loading_clip: "Φόρτωση κλιπ…",
    no_events: "Δεν βρέθηκαν συμβάντα.",
    load_more: "Φόρτωση περισσότερων",
    load_less: "Λιγότερα",
    refresh: "Ανανέωση",
    close: "Κλείσιμο",
    select_to_play: "Επιλέξτε ένα συμβάν για αναπαραγωγή του κλιπ",
    no_description: "– καμία περιγραφή –",
    clip_no_recording: "Δεν υπάρχει διαθέσιμο κλιπ στο Frigate για αυτό το συμβάν (δεν υπάρχει εγγραφή για αυτό το χρονικό διάστημα).",
    all_labels: "Όλες οι ετικέτες",
    all_cameras: "Όλες οι κάμερες",
    labels_plural: "ετικέτες",
    cameras_plural: "κάμερες",
    filter_today: "Σήμερα",
    filter_yesterday: "Χθες",
    filter_week: "Τελευταίες 7 ημέρες",
    filter_all: "Όλα",
    today: "Σήμερα",
    yesterday: "Χθες",
    live: "Ζωντανά",
    live_connecting: "Σύνδεση…",
    live_failed: "Η ζωντανή ροή απέτυχε",
    live_no_camera: "Δεν υπάρχει διαθέσιμη κάμερα για ζωντανή προβολή",
    ptz: { label: "Χειριστήρια PTZ", up: "Πάνω", down: "Κάτω", left: "Αριστερά", right: "Δεξιά", stop: "Διακοπή", failed: "Η εντολή PTZ απέτυχε. Ελέγξτε τη σύνδεση και τα δικαιώματα." },
    timeline_loading: "Φόρτωση εγγραφής…",
    timeline_no_recording: "Δεν υπάρχει εγγραφή για αυτήν την περίοδο",
    timeline_no_camera: "Δεν υπάρχει διαθέσιμη κάμερα για το χρονολόγιο",
    timeline_failed: "Δεν ήταν δυνατή η φόρτωση της εγγραφής",
    timeline_zoom_in: "Μεγέθυνση",
    timeline_zoom_out: "Σμίκρυνση",
  },
  pt: {
    title: "Linha do tempo do Frigate",
    loading_events: "Carregando eventos…",
    loading_clip: "Carregando clipe…",
    no_events: "Nenhum evento encontrado.",
    load_more: "Carregar mais",
    load_less: "Menos",
    refresh: "Atualizar",
    close: "Fechar",
    select_to_play: "Selecione um evento para reproduzir o clipe",
    no_description: "– sem descrição –",
    clip_no_recording: "Nenhum clipe disponível no Frigate para este evento (sem gravação para este intervalo de tempo).",
    all_labels: "Todas as etiquetas",
    all_cameras: "Todas as câmeras",
    labels_plural: "etiquetas",
    cameras_plural: "câmeras",
    filter_today: "Hoje",
    filter_yesterday: "Ontem",
    filter_week: "Últimos 7 dias",
    filter_all: "Todos",
    today: "Hoje",
    yesterday: "Ontem",
    live: "Ao vivo",
    live_connecting: "Conectando…",
    live_failed: "Falha na transmissão ao vivo",
    live_no_camera: "Nenhuma câmera disponível para visualização ao vivo",
    ptz: { label: "Controles PTZ", up: "Para cima", down: "Para baixo", left: "Para a esquerda", right: "Para a direita", stop: "Parar", failed: "Falha no comando PTZ. Verifique a conexão e as permissões." },
    timeline_loading: "Carregando gravação…",
    timeline_no_recording: "Nenhuma gravação para este período",
    timeline_no_camera: "Nenhuma câmera disponível para a linha do tempo",
    timeline_failed: "Não foi possível carregar a gravação",
    timeline_zoom_in: "Aumentar zoom",
    timeline_zoom_out: "Diminuir zoom",
  },
};

STRINGS.nb = STRINGS.no;
STRINGS.nn = STRINGS.no;
STRINGS.hr = STRINGS.sr;
STRINGS.bs = STRINGS.sr;
STRINGS.sh = STRINGS.sr;

import {
  LitElement,
  html,
  css,
} from "./vendor/lit-3.3.3.js";

// The vendored ESM HLS build runs transmuxing on the main thread unless a
// separately served workerPath is configured. Keep the prior no-worker delivery
// model rather than adding a new runtime asset or network path for this update.
const HLS_MODULE = "./vendor/hls-1.7.4.js";
let _hlsLoadPromise = null;
function loadHls() {
  if (_hlsLoadPromise) return _hlsLoadPromise;
  _hlsLoadPromise = import(HLS_MODULE).then((module) => {
    const Hls = module.default;
    if (typeof Hls !== "function") {
      throw new Error("Bundled hls.js module did not provide its default export");
    }
    return Hls;
  });
  return _hlsLoadPromise;
}

/* ───────── go2rtc URL resolution (shared by main card + tile) ───────── */

function isLocalNetwork() {
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return true;
  if (/^fd[0-9a-f]{2}:/i.test(h)) return true;
  return false;
}

function go2rtcBase(config) {
  if (isLocalNetwork()) {
    const u = config.go2rtc_url;
    if (u && typeof u === "string") return u.replace(/\/+$/, "");
    const f = config.frigate_url;
    if (f && typeof f === "string") return `${f.replace(/\/+$/, "")}/api/go2rtc`;
  } else {
    const ue = config.go2rtc_url_external;
    if (ue && typeof ue === "string") return ue.replace(/\/+$/, "");
  }
  return null;
}

function go2rtcHttpUrl(config, rest, cameraName) {
  const base = go2rtcBase(config);
  if (!base) return "";
  const q = `src=${encodeURIComponent(cameraName)}`;
  return `${base}/api/${rest}?${q}`;
}

function go2rtcWsUrl(config, cameraName) {
  const base = go2rtcBase(config);
  if (!base) return "";
  return `${base.replace(/^http/, "ws")}/api/ws?src=${encodeURIComponent(cameraName)}`;
}

function frigateProxyWsPath(config, cameraName, legacy = false) {
  const configuredClientId =
    typeof config?.frigate_client_id === "string"
      ? config.frigate_client_id.trim()
      : "";
  const clientId = configuredClientId || "frigate";
  const prefix = `/api/frigate/${encodeURIComponent(clientId)}`;
  const endpoint = legacy ? "mse/api/ws" : "go2rtc/ws/api/ws";
  return `${prefix}/${endpoint}?src=${encodeURIComponent(cameraName)}`;
}

/* ───────── Frigate event helpers ───────── */

const EVENT_ID_RE = /(\d{10}\.\d+-[a-z0-9]+)/i;
// Frigate publishes one event-search/clips root per enabled media source.
// Display titles are configurable and need not be unique across instances.
function selectClipsRoot(children, requestedId) {
  const candidates = [];
  for (const folder of children || []) {
    const match = /^media-source:\/\/frigate\/(?:(?<id>[^/]+)\/)?event-search\/clips\/*$/.exec(folder.media_content_id);
    if (match) candidates.push({ id: match.groups.id, folder });
  }
  const matches = requestedId ? candidates.filter(({ id }) => id === requestedId) : candidates;
  if (matches.length !== 1) {
    throw new Error("Frigate-Clips nicht eindeutig zugeordnet. Medienbrowser, frigate_vision_entry_id und frigate_client_id prüfen.");
  }
  return matches[0];
}

// event-search/clips/<name>/<after>/<before>/<camera>/<label>/<zone>.
// Empty camera slots identify date/label/zone filters, not camera folders.
function cameraForClipFolder(folder, searchPrefix, instancePrefix, knownCameras) {
  const id = folder.media_content_id;
  if (typeof id !== "string" || folder.can_expand === false) return null;
  if (id.startsWith(searchPrefix)) {
    const [, after, before, camera, label, zone] = id.slice(searchPrefix.length).split("/");
    return camera && !after && !before && !label && !zone ? camera.toLowerCase() : null;
  }
  if (id.startsWith("media-source://") && !id.startsWith(instancePrefix)) return null;
  if (/\/(?:event-search|event|recordings?)\//.test(id)) return null;

  // Older media browsers can supply opaque folder IDs. Only use the title
  // for those folders, never to override a structured Frigate identifier.
  const title = (folder.title || "").toLowerCase().replace(/\s*\(\d+\)$/, "").trim();
  if (!title || NON_CAMERA_FOLDERS.has(title)) return null;
  const name = title.replace(/\s+/g, "_");
  return !knownCameras.length || knownCameras.some(cam => cam.includes(name) || name.includes(cam)) ? name : null;
}

const NON_CAMERA_FOLDERS = new Set([
  "today", "yesterday", "last 24 hours", "last 7 days", "last 30 days", "all",
  "person", "people", "car", "dog", "cat", "bicycle", "motorcycle", "package", "bird",
]);

function normalizeDedupeWindow(value) {
  const seconds = typeof value === "number" || (typeof value === "string" && value.trim())
    ? Number(value) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : 30;
}

function parseFrigateEventId(mediaContentId) {
  if (!mediaContentId) return null;
  const m = mediaContentId.match(EVENT_ID_RE);
  return m ? m[1] : null;
}

const DATE_RE = /(\d{4}-\d{2}-\d{2})[\s_T](\d{2}:\d{2}:\d{2})/;
const LABEL_RE = /\b(person|persons|people|car|cars|dog|cat|bicycle|motorcycle|bird|package|bus|truck|mouse)\b/i;
const EVENT_ID_TS_RE = /^(\d+\.?\d*)-/;
function parseClipMeta(title, eventId = null) {
  let ts = null;
  let label = null;
  // Prefer event-id timestamp (Unix seconds, unambiguous UTC) over the title
  if (eventId) {
    const m = eventId.match(EVENT_ID_TS_RE);
    if (m) {
      const sec = parseFloat(m[1]);
      if (isFinite(sec) && sec > 0) ts = new Date(sec * 1000);
    }
  }
  if (!ts && title) {
    const dm = title.match(DATE_RE);
    if (dm) ts = new Date(`${dm[1]}T${dm[2]}`);
  }
  if (title) {
    const lm = title.match(LABEL_RE);
    if (lm) label = lm[1].toLowerCase();
  }
  return { ts, label };
}

function formatTime(d, t) {
  if (!d || isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const isToday = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (isToday) return `${t.today}, ${time}`;
  if (isYesterday) return `${t.yesterday}, ${time}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}., ${time}`;
}

const LABEL_DE = {
  person: "Person",
  persons: "Personen",
  people: "Personen",
  car: "Auto",
  cars: "Autos",
  vehicle: "Fahrzeug",
  truck: "LKW",
  bus: "Bus",
  dog: "Hund",
  cat: "Katze",
  bird: "Vogel",
  package: "Paket",
  bicycle: "Fahrrad",
  motorcycle: "Motorrad",
  mouse: "Maus",
  face: "Gesicht",
  license_plate: "Kennzeichen",
  amazon: "Amazon",
  dhl: "DHL",
  ups: "UPS",
  fedex: "FedEx",
  usps: "USPS",
};
// Turn a Frigate identifier such as "front_door-cam" into "Front Door Cam".
function humanizeIdentifier(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function translateLabel(label, lang) {
  if (!label) return "";
  const key = label.trim().toLowerCase();
  if (lang === "de" && LABEL_DE[key]) return LABEL_DE[key];
  return humanizeIdentifier(key);
}

const LABEL_ICONS = {
  person: "mdi:account-alert",
  persons: "mdi:account-group",
  people: "mdi:account-group",
  face: "mdi:face-recognition",
  car: "mdi:car-sports",
  cars: "mdi:car-multiple",
  vehicle: "mdi:car-sports",
  truck: "mdi:truck",
  bus: "mdi:bus",
  motorcycle: "mdi:motorbike",
  bicycle: "mdi:bike",
  dog: "mdi:dog",
  cat: "mdi:cat",
  bird: "mdi:bird",
  mouse: "mdi:rodent",
  package: "mdi:package-variant-closed",
  license_plate: "mdi:card-text-outline",
  amazon: "mdi:package-variant",
  dhl: "mdi:truck-delivery",
  ups: "mdi:truck-delivery",
  fedex: "mdi:truck-delivery",
  usps: "mdi:truck-delivery",
};
function labelIcon(rawLabel, userMap) {
  if (!rawLabel) return null;
  const key = String(rawLabel).trim().toLowerCase();
  if (userMap && typeof userMap === "object" && userMap[key]) return userMap[key];
  return LABEL_ICONS[key] || "mdi:tag";
}
function labelColor(rawLabel, userMap) {
  if (!rawLabel) return null;
  const key = String(rawLabel).trim().toLowerCase();
  if (userMap && typeof userMap === "object") {
    if (userMap[key]) return String(userMap[key]);
    if (userMap.default) return String(userMap.default);
  }
  return null;
}

function detectLang(hass, override) {
  if (override && override !== "auto") {
    const explicit = String(override).toLowerCase().split("-")[0];
    return STRINGS[explicit] ? explicit : "en";
  }
  const l =
    (hass?.locale?.language || hass?.language || navigator?.language || "en")
      .toLowerCase()
      .split("-")[0];
  return STRINGS[l] ? l : "en";
}

// Each WebRTC session owns its own signed socket, peer and cancellation scope.
// In particular, closing a send-only talk session must never close playback.
class Go2rtcSession {
  constructor(opts) {
    this._opts = opts;
    this._peerConnection = null;
    this._go2rtcWs = null;
    this._runGeneration = 0;
    this._runCancelers = new Set();
  }

  get isHD() { return this._isHD; }
  get cameraId() { return this._cameraId; }
  get runGeneration() { return this._runGeneration; }

  _config() { return this._opts.getConfig(); }
  _hass() { return this._opts.getHass?.(); }
  _videoEl() { return this._opts.getVideoEl(); }
  _streamName() { return this._opts.getStreamName(this._isHD); }
  _setState(patch) { this._opts.onState(patch); }
  _waitUpdate() { return this._opts.onUpdate(); }
  _log(...args) { console.info(this._opts.logPrefix || "[Livestream]", ...args); }
  _warn(...args) { console.warn(this._opts.logPrefix || "[Livestream]", ...args); }
  _staleRunError() {
    const error = new Error("Livestream run was superseded");
    error.staleRun = true;
    return error;
  }
  _isRunCurrent(runId) { return runId === this._runGeneration; }
  _assertRunCurrent(runId) {
    if (!this._isRunCurrent(runId)) throw this._staleRunError();
  }
  _registerRunCanceler(runId, canceler) {
    if (!this._isRunCurrent(runId)) {
      canceler();
      return () => {};
    }
    this._runCancelers.add(canceler);
    return () => this._runCancelers.delete(canceler);
  }
  _invalidateRun() {
    this._runGeneration++;
    const cancelers = this._runCancelers;
    this._runCancelers = new Set();
    for (const cancel of cancelers) {
      try { cancel(); } catch {}
    }
    return this._runGeneration;
  }

  _isIOS() {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    return /Mac/.test(ua) && navigator.maxTouchPoints > 1;
  }
  _isExternal() { return !isLocalNetwork(); }
  _hlsNativeSupported() {
    const v = document.createElement("video");
    return !!v.canPlayType && v.canPlayType("application/vnd.apple.mpegurl") !== "";
  }
  _supportedMSECodecs() {
    const MS = window.ManagedMediaSource || window.MediaSource;
    if (!MS) return "";
    const codecs = [
      "avc1.640029",      // H.264 high 4.1
      "avc1.64002A",      // H.264 high 4.2
      "avc1.640033",      // H.264 high 5.1
      "hvc1.1.6.L153.B0", // H.265 main 5.1
      "mp4a.40.2",        // AAC LC
      "mp4a.40.5",        // AAC HE
      "flac",
      "opus",
    ];
    return codecs
      .filter((c) => MS.isTypeSupported(`video/mp4; codecs="${c}"`))
      .join(",");
  }
  _checkMixedContent(url) {
    if (typeof location === "undefined") return;
    if (location.protocol !== "https:") return;
    if (!/^http:\/\//i.test(url)) return;
    const msg = "Mixed Content: HA ist HTTPS, go2rtc_url ist HTTP. Browser blockiert den Request.";
    this._warn(msg);
    throw new Error(msg);
  }
  _waitForIceGathering(pc, timeoutMs = 2000) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") { resolve(); return; }
      const timer = setTimeout(resolve, timeoutMs);
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") { clearTimeout(timer); resolve(); }
      });
    });
  }
  _withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      promise.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });
  }
  async _tryAutoplay(videoEl, runId = null) {
    if (runId !== null && !this._isRunCurrent(runId)) return;
    try { await videoEl.play(); }
    catch (e) {
      if (runId !== null && !this._isRunCurrent(runId)) return;
      if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) {
        videoEl.muted = true;
        try { await videoEl.play(); } catch {}
      }
    }
  }
  _describeMediaError(videoEl) {
    const err = videoEl?.error;
    if (!err) return "unknown error";
    const codes = {
      1: "MEDIA_ERR_ABORTED",
      2: "MEDIA_ERR_NETWORK",
      3: "MEDIA_ERR_DECODE",
      4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
    };
    return `${codes[err.code] || `code ${err.code}`}${err.message ? ": " + err.message : ""}`;
  }
  _safeLiveFailure(mode, error) {
    if (error?.staleRun) return "superseded";
    const message = String(error?.message || "");
    const safePatterns = [
      /^Der Frigate-Live-Proxy /,
      /^Home Assistant /,
      /^Für diesen Zugriff /,
      /^Direktes go2rtc-WebSocket /,
      /^Frigate-Live-Proxy(?: \(Legacy\))? /,
      /^Mixed Content:/,
      /^WebRTC (?:offer|answer|signaling|connection|candidates|track)/,
      /^go2rtc rejected /,
      /^WS (?:error|closed)/,
      /^MSE /,
      /^HLS /,
      /^MP4 /,
      /^MJPEG-/,
      /^No video element$/,
      /^ICE failed$/,
    ];
    if (safePatterns.some((pattern) => pattern.test(message))) return message;
    return `${String(mode || "live").toUpperCase()} setup failed`;
  }

  _go2rtcBase(config = this._config()) { return go2rtcBase(config); }
  _usesDirectGo2rtc(config = this._config()) {
    const hasExplicitDirectUrl =
      typeof config?._go2rtc_direct_override === "boolean"
        ? config._go2rtc_direct_override
        : Boolean(
            config?.go2rtc_url ||
            config?.go2rtc_url_external ||
            config?.frigate_url
          );
    return hasExplicitDirectUrl && Boolean(this._go2rtcBase(config));
  }
  _hlsStreamPath(name) { return `${go2rtcHttpUrl(this._config(), "stream.m3u8", name)}&mp4=flac`; }
  _mp4StreamPath(name) { return go2rtcHttpUrl(this._config(), "stream.mp4", name); }
  _mjpegStreamPath(name) { return go2rtcHttpUrl(this._config(), "stream.mjpeg", name); }

  /* WebRTC via HTTP (WHIP-style) */
  async _startWebRTCviaHTTP(name, videoEl, runId = this._runGeneration) {
    this._assertRunCurrent(runId);
    const config = this._config();
    const pc = new RTCPeerConnection({
      bundlePolicy: "max-bundle",
    });
    this._assertRunCurrent(runId);
    this._peerConnection = pc;
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    let trackSettled = false;
    let settleTrack;
    let trackTimer = null;
    let ctrl = null;
    const trackPromise = new Promise((resolveTrack) => {
      let videoTrackReceived = false;
      let transportConnected = false;
      settleTrack = resolveTrack;
      const finishTrack = (error = null) => {
        if (trackSettled) return;
        trackSettled = true;
        if (trackTimer) clearTimeout(trackTimer);
        resolveTrack(error);
      };
      const updateTransportState = () => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) {
          finishTrack(this._staleRunError());
          return;
        }
        const iceState = pc.iceConnectionState;
        if (this._connectionLost(pc)) this._onDisconnect();
        if (iceState === "failed") {
          finishTrack(new Error("WebRTC ICE failed"));
          return;
        }
        transportConnected =
          iceState === "connected" || iceState === "completed";
        if (videoTrackReceived && transportConnected) finishTrack();
      };
      pc.ontrack = (ev) => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) return;
        this._log("WebRTC-HTTP: track", ev.track.kind);
        if (!videoEl.srcObject) videoEl.srcObject = new MediaStream();
        try { videoEl.srcObject.addTrack(ev.track); } catch {}
        if (ev.track?.kind === "video") {
          videoTrackReceived = true;
          updateTransportState();
        }
      };
      pc.addEventListener("iceconnectionstatechange", () => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) return;
        this._log("WebRTC-HTTP: iceState", pc.iceConnectionState);
        updateTransportState();
      });
      pc.addEventListener("connectionstatechange", updateTransportState);
    });

    const cancelRun = () => {
      try { ctrl?.abort(); } catch {}
      settleTrack(this._staleRunError());
      try { pc.close(); } catch {}
      if (this._peerConnection === pc) this._peerConnection = null;
    };
    const unregisterCancel = this._registerRunCanceler(runId, cancelRun);
    let abortTimer = null;
    try {
      let offer;
      try {
        offer = await pc.createOffer();
        this._assertRunCurrent(runId);
        await pc.setLocalDescription(offer);
      } catch (error) {
        if (error?.staleRun || !this._isRunCurrent(runId)) throw this._staleRunError();
        throw new Error("WebRTC offer setup failed");
      }
      await this._waitForIceGathering(pc, 2500);
      this._assertRunCurrent(runId);
      const url = go2rtcHttpUrl(config, "webrtc", name);
      this._checkMixedContent(url);
      this._log("WebRTC-HTTP: sending offer");
      ctrl = new AbortController();
      abortTimer = setTimeout(() => ctrl.abort(), 5000);
      let resp;
      try {
        resp = await fetch(url, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "text/plain" },
          body: pc.localDescription.sdp,
        });
      } catch (error) {
        if (!this._isRunCurrent(runId)) throw this._staleRunError();
        throw new Error(
          error?.name === "AbortError"
            ? "WebRTC signaling timeout"
            : "WebRTC signaling network failure"
        );
      }
      this._assertRunCurrent(runId);
      if (!resp.ok) throw new Error(`WebRTC signaling failed with HTTP ${resp.status}`);
      const body = await resp.text();
      let answerSdp;
      if (body.trimStart().startsWith("{")) {
        try { answerSdp = JSON.parse(body).sdp; }
        catch { throw new Error("WebRTC answer was invalid"); }
      } else {
        answerSdp = body;
      }
      if (!answerSdp) throw new Error("WebRTC answer was empty");
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch {
        throw new Error("WebRTC answer was rejected");
      }
      this._assertRunCurrent(runId);
      this._log("WebRTC-HTTP: remote desc set, waiting for track");
      trackTimer = setTimeout(
        () => settleTrack(new Error("WebRTC track timeout")),
        6000
      );
      const trackError = await trackPromise;
      if (trackError) throw trackError;
      this._assertRunCurrent(runId);
      this._playbackReady(name, videoEl, runId, config, resp.redirected);
    } finally {
      if (abortTimer) clearTimeout(abortTimer);
      if (trackTimer) clearTimeout(trackTimer);
      unregisterCancel();
    }
  }

  /* WebRTC via WebSocket signaling */
  async _startWebRTCviaWS(name, videoEl, runId = this._runGeneration, mic = null) {
    this._assertRunCurrent(runId);
    const config = this._config();
    // An explicit playback URL is never a microphone signaling destination.
    const ws = mic ? await this._openProxyWs(name, runId, config)
      : await this._openGo2rtcWs(name, runId, config);
    this._assertRunCurrent(runId);
    this._log("WebRTC-WS: opened");
    const pc = new RTCPeerConnection({
      bundlePolicy: "max-bundle",
    });
    this._assertRunCurrent(runId);
    this._peerConnection = pc;
    // A microphone-only consumer makes go2rtc reject a stream with no matching
    // backchannel. A combined A/V offer can succeed for video alone.
    let outgoing;
    if (mic) {
      outgoing = pc.addTransceiver(mic, { direction: "sendonly" });
    } else {
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
    }

    return new Promise((resolve, reject) => {
      let done = false;
      let videoTrackReceived = false;
      let transportConnected = false;
      let candidatesOut = 0;
      let rejectedCandidates = 0;
      let unregisterCancel = () => {};
      const timeout = setTimeout(
        () => finish(new Error("WebRTC connection timeout")),
        12000
      );
      const finish = (err) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        unregisterCancel();
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = !err && mic ? () => this._onDisconnect() : null;
        if (err) reject(err); else resolve();
      };
      const maybeFinish = () => {
        if (
          !done &&
          (mic ? outgoing.currentDirection === "sendonly" : videoTrackReceived) &&
          transportConnected &&
          this._isRunCurrent(runId) &&
          this._peerConnection === pc
        ) {
          if (!mic) this._playbackReady(name, videoEl, runId, config);
          finish();
        }
      };
      const updateTransportState = () => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) {
          finish(this._staleRunError());
          return;
        }
        const iceState = pc.iceConnectionState;
        const connectionState = pc.connectionState;
        if (this._connectionLost(pc)) this._onDisconnect();
        if (iceState === "failed" || connectionState === "failed") {
          finish(new Error("WebRTC candidates were unreachable"));
          return;
        }
        transportConnected =
          iceState === "connected" ||
          iceState === "completed" ||
          connectionState === "connected";
        maybeFinish();
      };
      unregisterCancel = this._registerRunCanceler(
        runId,
        () => finish(this._staleRunError())
      );
      pc.ontrack = (ev) => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) return;
        if (mic) return;
        this._log("WebRTC-WS: track", ev.track.kind);
        if (!videoEl.srcObject) videoEl.srcObject = new MediaStream();
        try { videoEl.srcObject.addTrack(ev.track); } catch {}
        if (ev.track?.kind === "video") {
          videoTrackReceived = true;
          updateTransportState();
        }
      };
      pc.onicecandidate = (ev) => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) return;
        if (ev.candidate && ws.readyState === 1) {
          candidatesOut++;
          try {
            ws.send(JSON.stringify({ type: "webrtc/candidate", value: ev.candidate.candidate }));
          } catch {}
        } else if (!ev.candidate) {
          this._log("WebRTC-WS: ICE gathering complete, sent", candidatesOut, "candidates");
        }
      };
      pc.addEventListener("iceconnectionstatechange", () => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) return;
        this._log("WebRTC-WS: iceState", pc.iceConnectionState);
        updateTransportState();
      });
      pc.addEventListener("connectionstatechange", () => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) return;
        this._log("WebRTC-WS: connState", pc.connectionState);
        updateTransportState();
      });
      ws.onmessage = async (msg) => {
        if (!this._isRunCurrent(runId) || this._peerConnection !== pc) {
          finish(this._staleRunError());
          return;
        }
        if (typeof msg.data !== "string") return;
        let data;
        try { data = JSON.parse(msg.data); } catch { return; }
        this._log("WebRTC-WS: msg", data.type);
        if (data.type === "webrtc/answer") {
          try {
            await pc.setRemoteDescription({ type: "answer", sdp: data.value });
            this._assertRunCurrent(runId);
            this._log("WebRTC-WS: remote desc set");
            if (mic && outgoing.currentDirection !== "sendonly") {
              finish(new Error("No compatible audio backchannel"));
            } else {
              maybeFinish();
            }
          } catch (error) {
            finish(
              error?.staleRun
                ? error
                : new Error("WebRTC answer was rejected")
            );
          }
        } else if (data.type === "webrtc/candidate" && data.value) {
          try { await pc.addIceCandidate({ candidate: data.value, sdpMid: "0" }); }
          catch {
            rejectedCandidates++;
            this._warn("WebRTC-WS: candidate rejected", rejectedCandidates);
          }
        } else if (data.type === "error") {
          finish(new Error(mic ? "No compatible audio backchannel" : "go2rtc rejected the WebRTC request"));
        }
      };
      ws.onerror = () => finish(new Error("WS error during WebRTC signaling"));
      ws.onclose = () => { if (!done) finish(new Error("WS closed during WebRTC signaling")); };
      (async () => {
        try {
          const offer = await pc.createOffer();
          this._assertRunCurrent(runId);
          await pc.setLocalDescription(offer);
          // The signed socket already trickles ICE; don't delay a held talk button.
          if (!mic) await this._waitForIceGathering(pc, 2500);
          this._assertRunCurrent(runId);
          if (done) return;
          this._log("WebRTC-WS: sending offer (post-gather)");
          ws.send(JSON.stringify({ type: "webrtc/offer", value: pc.localDescription.sdp }));
        } catch (error) {
          finish(
            error?.staleRun
              ? error
              : new Error("WebRTC offer setup failed")
          );
        }
      })();
    });
  }

  async _signedProxyWsUrl(path, runId = this._runGeneration) {
    this._assertRunCurrent(runId);
    const hass = this._hass();
    if (!hass?.callWS) {
      const error = new Error(
        "Home Assistant ist für den Frigate-Live-Proxy nicht verfügbar."
      );
      error.proxySigning = true;
      throw error;
    }
    let result;
    try {
      result = await hass.callWS({
        type: "auth/sign_path",
        path,
        expires: 300,
      });
    } catch (cause) {
      if (cause?.staleRun || !this._isRunCurrent(runId)) {
        throw this._staleRunError();
      }
      const signingError = new Error(
        "Der Frigate-Live-Proxy konnte nicht authentifiziert werden."
      );
      signingError.proxySigning = true;
      throw signingError;
    }
    this._assertRunCurrent(runId);
    if (!result?.path) {
      const error = new Error(
        "Home Assistant hat keinen signierten Frigate-Live-Pfad geliefert."
      );
      error.proxySigning = true;
      throw error;
    }
    const runtimeOrigin =
      location.origin ||
      `${location.protocol}//${location.hostname}`;
    const signed = new URL(result.path, runtimeOrigin);
    if (signed.origin !== runtimeOrigin) {
      const error = new Error(
        "Home Assistant hat einen ungültigen Frigate-Live-Pfad geliefert."
      );
      error.proxySigning = true;
      throw error;
    }
    signed.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return signed.toString();
  }

  _connectGo2rtcWs(url, routeLabel, runId = this._runGeneration) {
    return new Promise((resolve, reject) => {
      if (!this._isRunCurrent(runId)) {
        reject(this._staleRunError());
        return;
      }
      if (location.protocol === "https:" && /^ws:\/\//i.test(url)) {
        reject(new Error("Mixed Content: HTTPS Seite kann kein ws:// laden. go2rtc_url_external mit https:// konfigurieren."));
        return;
      }
      let ws;
      try {
        ws = new WebSocket(url);
      } catch {
        reject(new Error(`${routeLabel} konnte nicht geöffnet werden.`));
        return;
      }
      this._go2rtcWs = ws;
      ws.binaryType = "arraybuffer";
      let settled = false;
      let unregisterCancel = () => {};
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unregisterCancel();
        ws.onopen = null;
        ws.onerror = null;
        ws.onclose = null;
        if (error) {
          try { ws.close(); } catch {}
          if (this._go2rtcWs === ws) this._go2rtcWs = null;
          reject(error);
        } else {
          resolve(ws);
        }
      };
      const timeout = setTimeout(
        () => finish(new Error(`${routeLabel} hat nicht rechtzeitig geantwortet.`)),
        5000
      );
      unregisterCancel = this._registerRunCanceler(
        runId,
        () => finish(this._staleRunError())
      );
      if (settled) return;
      ws.onopen = () => {
        if (!this._isRunCurrent(runId)) {
          finish(this._staleRunError());
          return;
        }
        finish();
      };
      ws.onerror = () => finish(new Error(`${routeLabel} ist nicht erreichbar.`));
      ws.onclose = () => finish(new Error(`${routeLabel} wurde vorzeitig geschlossen.`));
    });
  }

  async _openGo2rtcWs(name, runId = this._runGeneration, config = this._config()) {
    this._assertRunCurrent(runId);
    if (this._usesDirectGo2rtc(config)) {
      const directUrl = go2rtcWsUrl(config, name);
      if (!directUrl) {
        throw new Error(
          "Für diesen Zugriff ist kein direkter go2rtc-Endpunkt konfiguriert."
        );
      }
      return this._connectGo2rtcWs(
        directUrl,
        "Direktes go2rtc-WebSocket",
        runId
      );
    }

    return this._openProxyWs(name, runId, config);
  }

  async _openProxyWs(name, runId, config) {
    this._assertRunCurrent(runId);
    const routes =
      this._proxyRoute === "legacy"
        ? [{ legacy: true, label: "Frigate-Live-Proxy (Legacy)" }]
        : [
            { legacy: false, label: "Frigate-Live-Proxy" },
            { legacy: true, label: "Frigate-Live-Proxy (Legacy)" },
          ];
    let lastError = null;
    for (const route of routes) {
      try {
        const path = frigateProxyWsPath(config, name, route.legacy);
        const signedUrl = await this._signedProxyWsUrl(path, runId);
        this._assertRunCurrent(runId);
        const ws = await this._connectGo2rtcWs(
          signedUrl,
          route.label,
          runId
        );
        this._assertRunCurrent(runId);
        this._proxyRoute = route.legacy ? "legacy" : "primary";
        return ws;
      } catch (error) {
        lastError = error;
        if (error?.staleRun || !this._isRunCurrent(runId)) {
          throw this._staleRunError();
        }
        if (error?.proxySigning) throw error;
      }
    }
    throw new Error(
      `Der Frigate-Live-Proxy ist nicht erreichbar${
        lastError?.message ? `: ${lastError.message}` : "."
      }`
    );
  }

  _connectionLost(pc) {
    const lost = ["disconnected", "failed", "closed"];
    return lost.includes(pc.iceConnectionState) || lost.includes(pc.connectionState);
  }
  _onDisconnect() { this._opts.onDisconnect?.(); }
  _cleanupWebRTC() {
    const pc = this._peerConnection;
    this._peerConnection = null;
    this._webRtcStream = null;
    try { pc?.close(); } catch {}
  }
  _cleanupGo2rtcWs() {
    if (this._go2rtcWs) {
      this._go2rtcWs.onmessage = null;
      this._go2rtcWs.onerror = null;
      this._go2rtcWs.onclose = null;
      try { this._go2rtcWs.close(); } catch {}
      this._go2rtcWs = null;
    }
  }
  close() {
    this._invalidateRun();
    this._cleanupWebRTC();
    this._cleanupGo2rtcWs();
  }
}

const DOORBELL_REPLIES = Object.freeze({ wait: "Einen Moment bitte", leave: "Bitte vor der Tür abstellen" });
// Match doorbell_replies.py: 20 s source + 250 ms tail, 16 kHz PCM16 mono.
// Canonical WAV header is 44 bytes; two bytes per frame need no RIFF pad byte.
const MAX_CUSTOM_REPLY_WAV_BYTES = 44 + (20 * 16000 + 16000 / 4) * 2;
const MAX_CUSTOM_REPLY_BASE64_CHARS = 4 * Math.ceil(MAX_CUSTOM_REPLY_WAV_BYTES / 3);
const DOORBELL_RING_MS = 25000;
const DOORBELL_CLOCK_SKEW_MS = 2000;
// Leave time for mapping, signaling and a full TTS clip, but bound even a stuck reply.
const DOORBELL_REPLY_TIMEOUT_MS = 60000;

// Own handset silhouette, flat for decline/end and diagonal for answer.
function doorbellHandset(diagonal = false) {
  return html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path transform=${diagonal ? "rotate(135 12 12)" : ""}
      d="M3 11.6c5-4.2 13-4.2 18 0l.5.5v3.6c0 .6-.6 1-1.2.8l-3.4-1a1 1 0 0 1-.7-.9v-1.8a13 13 0 0 0-8.4 0v1.8a1 1 0 0 1-.7.9l-3.4 1c-.6.2-1.2-.2-1.2-.8v-3.6z" />
  </svg>`;
}

function doorbellMicIcon(muted) {
  return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d=${muted ? "M9 6V5a3 3 0 0 1 6 0v6M9 12a3 3 0 0 0 3 3m6-1a6 6 0 0 1-12-2v-1m6 7v4m-3 0h6M3 3l18 18"
      : "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM6 11v1a6 6 0 0 0 12 0v-1m-6 7v4m-3 0h6"} />
  </svg>`;
}

function doorbellSpeakerIcon(muted) {
  return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M3 9v6h4l5 4V5L7 9z" />
    <path d=${muted ? "m16 9 6 6m0-6-6 6" : "M16 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"} />
  </svg>`;
}

// One recent call per HA connection and configured trigger/camera. Records
// survive card replacement but never own a controller, an element or audio.
const doorbellCalls = new WeakMap();

function retainDoorbellCall(calls, key, call) {
  clearTimeout(call.cleanup);
  const until = Math.max(call.expiresAt, call.time + DOORBELL_RING_MS);
  call.cleanup = setTimeout(() => {
    if (calls.get(key) === call) calls.delete(key);
  }, Math.max(0, until - Date.now()));
}
const doorbellAudioUrl = (file) => new URL(`./doorbell/${file}.flac`, import.meta.url).href;

function normalizeDoorbell(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    ...value,
    enabled: value.enabled === true,
    entity: typeof value.entity === "string" ? value.entity.trim().toLowerCase() : "",
    from: value.from == null ? "off" : String(value.from),
    to: value.to == null ? "on" : String(value.to),
  };
}

function usableDoorbell(d) {
  const usableState = (s) => !!s && s !== "unknown" && s !== "unavailable";
  return d?.enabled && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(d.entity)
    && usableState(d.from) && usableState(d.to) && d.from !== d.to;
}

function doorbellViewError(config, cameras, camera) {
  if (!camera) return "choose";
  const raw = config.cameras;
  const names = Array.isArray(raw)
    ? raw.flatMap(item => typeof item === "string" ? [item] : item?.id ? [item.id] : Object.keys(item || {}).length === 1 ? Object.keys(item) : [])
    : raw && typeof raw === "object" ? Object.keys(raw) : raw === "all" ? [] : [raw];
  if (names.filter(id => String(id || "").trim().toLowerCase() === camera).length > 1) return "ambiguous";
  if (!Object.hasOwn(cameras, camera)) return "missing";
  if (!usableDoorbell(cameras[camera].doorbell)) return "trigger";
  if (config.live_provider === "off") return "liveOff";
  return null;
}

const DOORBELL_VIEW_MESSAGES = {
  de: {
    choose: "Wähle unter „Kameras“ genau eine Kamera für den Doorbell-Modus.",
    missing: "Die gewählte Doorbell-Kamera ist nicht in dieser Karte konfiguriert.",
    trigger: "Aktiviere Doorbell für die gewählte Kamera und prüfe Klingel-Entität, Von- und Zielzustand.",
    liveOff: "Der Doorbell-Modus benötigt einen aktivierten Livestream.",
    ambiguous: "Die gewählte Doorbell-Kamera ist nicht eindeutig. Prüfe Kamera-ID und Frigate-Instanz.",
    unavailable: "Die gewählte Doorbell-Kamera ist in der ausgewählten Frigate-Instanz in Home Assistant nicht verfügbar.",
    profile: "Das gewählte Frigate-Vision-Profil kann keiner Frigate-Instanz zugeordnet werden.",
  },
  en: {
    choose: "Select exactly one camera under Cameras for Doorbell mode.",
    missing: "The selected doorbell camera is not configured on this card.",
    trigger: "Enable Doorbell for the selected camera and check the entity, from state and to state.",
    liveOff: "Doorbell mode needs live streaming enabled.",
    ambiguous: "The selected doorbell camera is ambiguous. Check its camera ID and Frigate instance.",
    unavailable: "The selected doorbell camera is not available in Home Assistant for the selected Frigate instance.",
    profile: "The selected Frigate Vision profile could not be matched to a Frigate instance.",
  },
};

// Microphone ownership is exclusive across this page's live players.
let talkOwner = null;
class LivestreamController extends Go2rtcSession {
  constructor(opts) {
    super(opts);
    this._isHD = false;
    this._cameraId = null;
    this._mediaSource = null;
    this._sourceBuffer = null;
    this._mseBuf = null;
    this._mseBufLen = 0;
    this._mjpegRefreshTimer = null;
    this._talk = null;
  }

  get playbackTarget() { return this._webRtcStream || this._mseStream; }

  _streamTarget(name, config, redirected = false) {
    // Pin the signaling target, not a profile that may change during startup.
    return {
      name, camera: this.cameraId, client: config.frigate_client_id,
      entry: config.frigate_vision_entry_id, redirected,
      directBase: this._usesDirectGo2rtc(config) ? go2rtcBase(config) : null,
    };
  }

  _playbackReady(name, videoEl, runId, config, redirected = false) {
    this._webRtcStream = this._streamTarget(name, config, redirected);
    this._setState({ loading: false, provider: "webrtc" });
    this._tryAutoplay(videoEl, runId);
  }

  _onDisconnect() {
    if (this._talk) this.stopTalk("disconnected");
    this.stopAnnouncement();
    this.muteCameraAudio();
  }

  async _tryAutoplay(video, runId = null) {
    if (!this._opts.independentAudio) return super._tryAutoplay(video, runId);
    // The doorbell starts muted. A late autoplay rejection must not overwrite
    // a newer explicit receiver choice on this same video.
    if (runId === null || this._isRunCurrent(runId)) {
      try { await video.play(); } catch {}
    }
  }

  muteCameraAudio({ resume = false } = {}) {
    if (!this._opts.independentAudio) return;
    this._cameraAudioRequest = {};
    const video = this._videoEl();
    if (video) video.muted = true;
    this._setState({ cameraAudio: "off" });
    // Some browsers pause when unmuted without activation. If mute wins the
    // race with a pending play(), do not depend on that stale attempt to resume.
    if (resume && video?.paused && (video.srcObject || video.getAttribute("src"))) {
      this._tryAutoplay(video, this._runGeneration);
    }
  }

  async enableCameraAudio() {
    const video = this._videoEl();
    if (!this._opts.independentAudio || !video || (!video.srcObject && !video.getAttribute("src")) ||
        (this._peerConnection && this._connectionLost(this._peerConnection))) return;
    const source = video.srcObject, url = video.getAttribute("src");
    const request = this._cameraAudioRequest = {};
    const current = () => this._cameraAudioRequest === request && video === this._videoEl() &&
      video.srcObject === source && video.getAttribute("src") === url;
    if (video.volume === 0) video.volume = 1;
    video.muted = false;
    this._setState({ cameraAudio: "on" });
    try {
      await video.play();
      if (!current() || (!video.muted && !video.paused)) return;
    } catch {
      if (!current()) return;
    }
    video.muted = true;
    this._setState({ cameraAudio: "blocked" });
    if (video.paused) this._tryAutoplay(video, this._runGeneration);
  }

  _listenAfterTalkConnect(attempt) {
    const listen = attempt.listenAfterConnect;
    if (listen && listen.previous === this._cameraAudioRequest) this.enableCameraAudio();
    attempt.listenAfterConnect = null;
  }

  _backchannel(live, hass, onDisconnect) {
    const link = new Go2rtcSession({
      getConfig: () => ({ frigate_client_id: live.client }),
      getHass: () => hass,
      logPrefix: this._opts.logPrefix,
      onDisconnect,
    });
    link._proxyRoute = this._proxyRoute;
    return link;
  }

  get talkRequested() { return !!this._talk; }

  async startTalk(options = {}) {
    if (this._talk) {
      // Answer may adopt an idle mic request without capturing or joining again.
      if (this._opts.independentAudio && options.listen) {
        this._talk.listenAfterConnect = { previous: this._cameraAudioRequest };
        if (this._talk.mic) this._listenAfterTalkConnect(this._talk);
        return this._talk.ready;
      }
      return;
    }
    const ready = this._startTalk(options);
    if (this._talk) this._talk.ready = ready;
    return ready;
  }

  async _startTalk({ verifyTarget = false, listen = false } = {}) {
    if (this._announcement) return;
    const live = this._webRtcStream;
    if (!live || !this._peerConnection || this._connectionLost(this._peerConnection)) {
      this._setState({ talk: live ? "disconnected" : "requiresWebRTC" });
      return;
    }
    const hass = this._hass();
    if (!hass?.callWS || hass.connected === false) {
      this._setState({ talk: "haUnavailable" });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this._setState({ talk: "micUnavailable" });
      return;
    }
    talkOwner?.stopTalk();
    talkOwner = this;
    const link = this._backchannel(live, hass, () => {
      if (this._talk?.link === link) this.stopTalk("disconnected");
    });
    const independent = this._opts.independentAudio;
    const video = listen && !independent ? this._videoEl() : null;
    const playback = video && { video, source: video.srcObject, muted: video.muted, volume: video.volume, paused: video.paused };
    const listenAfterConnect = listen && independent ? { previous: this._cameraAudioRequest } : null;
    const attempt = this._talk = { link, stream: null, playback, listenAfterConnect };
    this._setState({ talk: "pending", talkAudioBlocked: false });
    try {
      if (verifyTarget || live.directBase) {
        const mapped = await this._withTimeout(streamMatchesCamera(hass, live), 5000, "Camera mapping").catch(() => false);
        if (this._talk !== attempt) return; // released during HA lookup
        if (!mapped) { this.stopTalk("unmapped"); return; }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Permission prompts cannot be cancelled. A late grant belongs to the old gesture.
      if (this._talk !== attempt) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      attempt.stream = stream;
      const [mic] = stream.getAudioTracks();
      if (!mic || mic.readyState === "ended") { this.stopTalk("micUnavailable"); return; }
      mic.enabled = false;
      mic.onended = () => { if (this._talk === attempt) this.stopTalk("micUnavailable"); };
      await link._withTimeout(link._startWebRTCviaWS(live.name, null, link.runGeneration, mic), 25000, "Talk");
      if (this._talk !== attempt) return;
      attempt.mic = mic;
      mic.enabled = true;
      this._setState({ talk: "sending", talkMuted: false });
      this._listenAfterTalkConnect(attempt);
      if (playback) {
        playback.observe = () => {
          if (this._talk === attempt && video.srcObject === playback.source && !playback.enabling) {
            this._setState({ talkAudioBlocked: video.muted || video.volume === 0 || video.paused });
          }
        };
        for (const event of ["pause", "playing", "volumechange"]) video.addEventListener(event, playback.observe);
        this._enableTalkAudio(attempt);
      }
    } catch (error) {
      if (this._talk !== attempt) return;
      const reason = error.name === "NotAllowedError" || error.name === "SecurityError" ? "denied"
        : error.proxySigning ? "haUnavailable"
        : !attempt.stream ? "micUnavailable"
        : error.message === "No compatible audio backchannel" ? "noChannel" : "connectionFailed";
      this.stopTalk(reason);
    }
  }

  enableTalkAudio() {
    // Called directly by the retry button, with a fresh trusted user gesture.
    if (this._talk?.playback && this._talk.mic) this._enableTalkAudio(this._talk, true);
  }

  async _enableTalkAudio(attempt, gesture = false) {
    const playback = attempt.playback;
    const { video, source } = playback;
    if (this._talk !== attempt || video !== this._videoEl() || video.srcObject !== source || playback.enabling) return;
    if (video.volume === 0 && !gesture) {
      this._setState({ talkAudioBlocked: true });
      return;
    }
    playback.enabling = playback.changed = true;
    try {
      if (video.volume === 0) {
        video.volume = 1;
        playback.changedVolume = true;
      }
      video.muted = false;
      // Negotiation/permission may outlive transient activation. If unmuted
      // play is blocked, restore playback and offer a new explicit gesture.
      await video.play();
      if (this._talk !== attempt || video.srcObject !== source) return;
      const blocked = video.muted || video.volume === 0 || video.paused;
      if (blocked) this._restoreTalkAudio(playback);
      this._setState({ talkAudioBlocked: blocked });
    } catch {
      if (this._talk !== attempt || video.srcObject !== source) return;
      this._restoreTalkAudio(playback);
      this._setState({ talkAudioBlocked: true });
    } finally {
      playback.enabling = false;
    }
  }

  _restoreTalkAudio(playback) {
    if (!playback?.changed) return;
    const { video, source, muted, volume, paused, changedVolume } = playback;
    // Never write into a player now showing a different stream.
    if (video.srcObject !== source) return;
    playback.changed = playback.changedVolume = false;
    video.muted = muted;
    if (changedVolume) video.volume = volume;
    if (paused) video.pause();
    else if (video.paused && video.isConnected) {
      try { video.play()?.catch(() => {}); } catch {}
    }
  }

  toggleTalkMute() {
    // A pending attempt has no active mic. Never touch the receiver or renegotiate.
    const mic = this._talk?.mic;
    if (!mic || mic.readyState !== "live") return;
    mic.enabled = !mic.enabled;
    this._setState({ talkMuted: !mic.enabled });
  }

  stopTalk(reason = "idle") {
    const attempt = this._talk;
    this._talk = null;
    if (talkOwner === this) talkOwner = null;
    for (const track of attempt?.stream?.getTracks() || []) {
      track.enabled = false;
      track.onended = null;
      track.stop();
    }
    attempt?.link.close();
    const playback = attempt?.playback;
    if (playback?.observe) {
      for (const event of ["pause", "playing", "volumechange"]) playback.video.removeEventListener(event, playback.observe);
    }
    this._restoreTalkAudio(playback);
    this._setState({ talk: reason, talkMuted: false, talkAudioBlocked: false });
  }

  async playDoorbellReply(reply) {
    const live = this.playbackTarget;
    const hass = this._hass();
    const bundled = Object.hasOwn(DOORBELL_REPLIES, reply);
    if ((!bundled && !customReplyId(reply)) || !live || live.camera !== this.cameraId ||
        !hass?.callWS || hass.connected === false || this._talk || this._announcement) return false;
    const attempt = { cancel: new AbortController() };
    this._announcement = attempt;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = attempt.context = new AudioContext();
      // Start from the reply click, before any asynchronous lookup. Audio goes
      // only to the sender track, never to the browser's speakers or microphone.
      const ready = ctx.resume();
      const file = bundled ? fetch(doorbellAudioUrl(reply), { signal: attempt.cancel.signal }).then((response) => {
        if (!response.ok) throw new Error("Doorbell reply unavailable");
        return response.arrayBuffer();
      }) : doorbellReplyRequest(hass, live, reply).then(({ audio }) => {
        if (typeof audio !== "string" || !audio || audio.length > MAX_CUSTOM_REPLY_BASE64_CHARS || audio.length % 4) {
          throw new Error("Doorbell reply unavailable");
        }
        // One extra byte can fit in the same base64 length. Check before atob.
        const padding = audio.endsWith("==") ? 2 : audio.endsWith("=") ? 1 : 0;
        if (audio.length / 4 * 3 - padding > MAX_CUSTOM_REPLY_WAV_BYTES) throw new Error("Doorbell reply unavailable");
        return Uint8Array.from(atob(audio), byte => byte.charCodeAt(0)).buffer;
      });
      const [mapped, bytes] = await this._withTimeout(Promise.all([
        streamMatchesCamera(hass, live), file, ready,
      ]), 5000, "Camera mapping and reply");
      const current = () => this._announcement === attempt && this.playbackTarget === live;
      if (!mapped || !current()) return false;
      const buffer = await ctx.decodeAudioData(bytes);
      if (!current()) return false;
      const output = attempt.output = ctx.createMediaStreamDestination();
      const source = attempt.source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(output);
      const link = attempt.link = this._backchannel(live, hass, () => {
        if (this._announcement === attempt) this.stopAnnouncement();
      });
      await link._withTimeout(link._startWebRTCviaWS(live.name, null, link.runGeneration, output.stream.getAudioTracks()[0]), 25000, "Doorbell reply");
      if (!current()) return false;
      await this._withTimeout(new Promise((resolve) => {
        attempt.cancel.signal.addEventListener("abort", resolve, { once: true });
        // The asset includes trailing silence to let the last speech packets drain.
        source.onended = resolve;
        source.start();
      }), buffer.duration * 1000 + 1000, "Doorbell playback");
      return current();
    } catch {
      return false;
    } finally {
      if (this._announcement === attempt) this.stopAnnouncement();
    }
  }

  stopAnnouncement() {
    const attempt = this._announcement;
    if (!attempt) return;
    this._announcement = null;
    attempt.cancel.abort();
    try { attempt.source?.stop(); } catch {}
    for (const track of attempt.output?.stream.getTracks() || []) track.stop();
    attempt.link?.close();
    attempt.context?.close().catch(() => {});
  }

  /* MSE */
  async _startMSE(ws, videoEl, runId = this._runGeneration) {
    this._assertRunCurrent(runId);
    const MS = window.ManagedMediaSource || window.MediaSource;
    if (!MS) throw new Error("MSE not supported");
    const ms = new MS();
    this._assertRunCurrent(runId);
    this._mediaSource = ms;
    this._sourceBuffer = null;
    this._mseBuf = new Uint8Array(2 * 1024 * 1024);
    this._mseBufLen = 0;
    this._setState({ provider: "mse" });

    if (window.ManagedMediaSource) {
      videoEl.disableRemotePlayback = true;
      videoEl.srcObject = ms;
    } else {
      videoEl.src = URL.createObjectURL(ms);
      videoEl.srcObject = null;
    }
    videoEl.muted = true;
    videoEl.playsInline = true;
    this._tryAutoplay(videoEl, runId);

    const codecs = this._supportedMSECodecs();
    this._log("MSE supported codecs:", codecs);

    return new Promise((resolve, reject) => {
      let done = false;
      let unregisterCancel = () => {};
      const finish = (error = null) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        unregisterCancel();
        if (this._mseReady === ready) this._mseReady = null;
        if (this._mseFailed === failed) this._mseFailed = null;
        if (error) reject(error); else resolve();
      };
      const ready = () => {
        if (!this._isRunCurrent(runId) || this._mediaSource !== ms) {
          finish(this._staleRunError());
          return;
        }
        this._setState({ loading: false });
        finish();
      };
      const failed = () => finish(new Error("MSE stream setup failed"));
      const timeout = setTimeout(
        () => finish(new Error("MSE stream timeout")),
        15000
      );
      this._mseReady = ready;
      this._mseFailed = failed;
      unregisterCancel = this._registerRunCanceler(
        runId,
        () => finish(this._staleRunError())
      );
      if (done) return;
      ws.onmessage = (msg) =>
        this._handleGo2rtcMessage(msg, videoEl, runId, ms);
      ms.addEventListener("sourceopen", () => {
        if (!this._isRunCurrent(runId) || this._mediaSource !== ms) {
          finish(this._staleRunError());
          return;
        }
        this._log("MSE sourceopen, sending codecs");
        if (window.ManagedMediaSource) {
          try { URL.revokeObjectURL(videoEl.src); } catch {}
        }
        try { ws.send(JSON.stringify({ type: "mse", value: codecs })); }
        catch { finish(new Error("MSE stream request failed")); }
      }, { once: true });
    });
  }
  _handleGo2rtcMessage(
    msg,
    videoEl,
    runId = this._runGeneration,
    expectedMediaSource = this._mediaSource
  ) {
    if (
      !this._isRunCurrent(runId) ||
      this._mediaSource !== expectedMediaSource
    ) return;
    if (typeof msg.data === "string") {
      let data;
      try { data = JSON.parse(msg.data); } catch { return; }
      if (data.type === "mse") {
        const mime = data.value;
        this._log("MSE codec from server:", mime);
        if (this._mediaSource && !this._sourceBuffer) {
          try {
            const sb = this._mediaSource.addSourceBuffer(mime);
            sb.mode = "segments";
            this._sourceBuffer = sb;
            sb.addEventListener("updateend", () => {
              if (
                !this._isRunCurrent(runId) ||
                this._mediaSource !== expectedMediaSource ||
                this._sourceBuffer !== sb
              ) return;
              if (!sb.updating && this._mseBufLen > 0) {
                try {
                  sb.appendBuffer(this._mseBuf.slice(0, this._mseBufLen));
                  this._mseBufLen = 0;
                } catch {}
              }
              if (!sb.updating && sb.buffered && sb.buffered.length) {
                const end = sb.buffered.end(sb.buffered.length - 1);
                const start = end - 5;
                const start0 = sb.buffered.start(0);
                if (start > start0) {
                  try { sb.remove(start0, start); } catch {}
                  try { this._mediaSource.setLiveSeekableRange(start, end); } catch {}
                }
                if (videoEl.currentTime < start) videoEl.currentTime = start;
              }
            });
            this._setState({ loading: false });
            if (this._mseReady) this._mseReady();
          } catch {
            this._warn("MSE addSourceBuffer failed");
            if (this._mseFailed) this._mseFailed();
          }
        }
      }
    } else {
      this._handleMSEData(msg.data);
    }
  }
  _handleMSEData(data) {
    const sb = this._sourceBuffer;
    if (!sb) return;
    if (sb.updating || this._mseBufLen > 0) {
      const b = new Uint8Array(data);
      const required = this._mseBufLen + b.byteLength;
      if (required > this._mseBuf.length) {
        const grown = new Uint8Array(Math.max(required, this._mseBuf.length * 2));
        grown.set(this._mseBuf.subarray(0, this._mseBufLen), 0);
        this._mseBuf = grown;
      }
      this._mseBuf.set(b, this._mseBufLen);
      this._mseBufLen += b.byteLength;
    } else {
      try { sb.appendBuffer(data); } catch {}
    }
  }

  /* HLS native */
  async _startHLS(name, runId = this._runGeneration) {
    this._assertRunCurrent(runId);
    if (!this._hlsNativeSupported()) throw new Error("HLS native not supported in this browser");
    const url = this._hlsStreamPath(name);
    this._checkMixedContent(url);
    return this._loadVideoSource(url, "hls", "HLS", 8000, runId);
  }

  /* MP4 progressive */
  async _startMP4(name, runId = this._runGeneration) {
    this._assertRunCurrent(runId);
    const url = this._mp4StreamPath(name);
    this._checkMixedContent(url);
    return this._loadVideoSource(url, "mp4", "MP4", 6000, runId);
  }

  /* Shared <video src> start for native HLS and progressive MP4 */
  _loadVideoSource(url, provider, label, timeoutMs, runId) {
    return new Promise((resolve, reject) => {
      this._setState({ provider });
      let done = false;
      let el = null;
      let unregisterCancel = () => {};
      const cleanup = () => {
        clearTimeout(timeout);
        if (el) {
          el.removeEventListener("loadeddata", onLoaded);
          el.removeEventListener("error", onError);
        }
      };
      const finish = (error = null) => {
        if (done) return;
        done = true;
        cleanup();
        unregisterCancel();
        if (error) reject(error); else resolve();
      };
      const onLoaded = () => {
        if (!this._isRunCurrent(runId)) {
          finish(this._staleRunError());
          return;
        }
        this._setState({ loading: false });
        if (el) this._tryAutoplay(el, runId);
        finish();
      };
      const onError = () => finish(new Error(`${label} media failed`));
      const timeout = setTimeout(
        () => finish(new Error(`${label} load timeout`)),
        timeoutMs
      );
      unregisterCancel = this._registerRunCanceler(
        runId,
        () => finish(this._staleRunError())
      );
      if (done) return;
      this._waitUpdate().then(() => {
        if (!this._isRunCurrent(runId)) {
          finish(this._staleRunError());
          return;
        }
        el = this._videoEl();
        if (!el) { finish(new Error("No video element")); return; }
        el.addEventListener("loadeddata", onLoaded, { once: true });
        el.addEventListener("error", onError, { once: true });
        el.src = url;
        el.load();
      });
    });
  }

  /* MJPEG */
  _startMJPEG(name, runId = this._runGeneration) {
    this._assertRunCurrent(runId);
    this._setState({
      provider: "mjpeg",
      loading: false,
      mjpegUrl: this._mjpegStreamPath(name),
    });
    this._cleanupMJPEG(false);
    this._mjpegRefreshTimer = setInterval(() => {
      if (!this._cameraId || !this._isRunCurrent(runId)) return;
      const sname = this._opts.getStreamName(this._isHD);
      this._setState({ mjpegUrl: this._mjpegStreamPath(sname) });
    }, 8 * 60 * 1000);
  }

  /* Orchestrator */
  async start(cameraId, expectedGeneration = null) {
    if (
      expectedGeneration !== null &&
      !this._isRunCurrent(expectedGeneration)
    ) return;
    const runId = this._invalidateRun();
    this._releaseResources();
    this._cameraId = cameraId;
    this._proxyRoute = null;
    const streamName = this._streamName();
    this._log("start: cam=", cameraId, "hd=", this._isHD);
    const configured = this._config().go2rtc_modes || DEFAULT_GO2RTC_MODES;
    const modes = configured.split(",").map((s) => s.trim().toLowerCase());

    const failures = [];
    for (const mode of modes) {
      if (!this._isRunCurrent(runId) || this._cameraId !== cameraId) return;
      const videoEl = this._videoEl();
      try {
        if (mode === "webrtc" && window.RTCPeerConnection) {
          if (!videoEl) continue;
          let lastErr = null;
          if (this._usesDirectGo2rtc()) {
            try {
              await this._withTimeout(
                this._startWebRTCviaHTTP(streamName, videoEl, runId),
                12000,
                "WebRTC-HTTP"
              );
              this._assertRunCurrent(runId);
              this._log("WebRTC (HTTP/WHIP) connected");
              return;
            } catch (e) {
              if (e?.staleRun || !this._isRunCurrent(runId)) return;
              lastErr = e;
              this._warn(
                "WebRTC-HTTP failed:",
                this._safeLiveFailure("webrtc", e)
              );
              this._cleanupWebRTC();
              if (this._opts.independentAudio) this._clearVideo();
            }
          }
          try {
            await this._withTimeout(
              this._startWebRTCviaWS(streamName, videoEl, runId),
              25000,
              "WebRTC-WS"
            );
            this._assertRunCurrent(runId);
            this._log("WebRTC (WS) connected");
            return;
          } catch (e) {
            if (e?.staleRun || !this._isRunCurrent(runId)) return;
            lastErr = e;
            this._cleanupWebRTC();
            this._cleanupGo2rtcWs();
            throw lastErr || e;
          }
        } else if (mode === "mse" && (window.MediaSource || window.ManagedMediaSource)) {
          if (!videoEl) continue;
          const config = this._config();
          const ws = await this._withTimeout(
            this._openGo2rtcWs(streamName, runId, config),
            12000,
            "MSE WS"
          );
          this._assertRunCurrent(runId);
          this._mseStream = this._streamTarget(streamName, config);
          await this._withTimeout(
            this._startMSE(ws, videoEl, runId),
            8000,
            "MSE setup"
          );
          this._assertRunCurrent(runId);
          this._log("MSE connected");
          return;
        } else if (mode === "mp4") {
          if (!this._usesDirectGo2rtc()) {
            throw new Error("MP4-Live benötigt einen direkten go2rtc-URL-Override.");
          }
          await this._withTimeout(
            this._startMP4(streamName, runId),
            8000,
            "MP4"
          );
          this._assertRunCurrent(runId);
          this._log("MP4 connected");
          return;
        } else if (mode === "hls") {
          if (!this._usesDirectGo2rtc()) {
            throw new Error("HLS-Live benötigt einen direkten go2rtc-URL-Override.");
          }
          await this._withTimeout(
            this._startHLS(streamName, runId),
            10000,
            "HLS"
          );
          this._assertRunCurrent(runId);
          this._log("HLS connected");
          return;
        } else if (mode === "mjpeg") {
          if (!this._usesDirectGo2rtc()) {
            throw new Error("MJPEG-Live benötigt einen direkten go2rtc-URL-Override.");
          }
          this._startMJPEG(streamName, runId);
          this._log("MJPEG started");
          return;
        }
      } catch (e) {
        if (e?.staleRun || !this._isRunCurrent(runId)) return;
        const msg = this._safeLiveFailure(mode, e);
        this._warn(`${mode} failed:`, msg);
        failures.push(`${mode}: ${msg}`);
        if (mode === "webrtc") this._cleanupWebRTC();
        if (mode === "mse") { this._cleanupMSE(); this._cleanupGo2rtcWs(); }
        // The next transport must not inherit the failed receiver's tracks or
        // MediaSource. In particular, WS must not append to a failed HTTP stream.
        if (this._opts.independentAudio) this._clearVideo();
      }
    }

    if (this._isHD) {
      if (!this._isRunCurrent(runId)) return;
      this._warn("HD stream failed (likely H.265), falling back to SD:", failures);
      this._isHD = false;
      this.cleanup();
      const fallbackGeneration = this._runGeneration;
      this._setState({ loading: true, provider: null, error: null });
      await this._waitUpdate();
      if (!this._isRunCurrent(fallbackGeneration)) return;
      return this.start(cameraId, fallbackGeneration);
    }

    if (!this._isRunCurrent(runId)) return;
    const errMsg = this._usesDirectGo2rtc()
      ? (this._opts.failedMessage || "Livestream konnte nicht verbunden werden.")
      : "Der Frigate-Live-Proxy konnte keinen kompatiblen Stream verbinden.";
    this._setState({ error: errMsg, loading: false });
  }

  setHD(hd) {
    if (this._isHD === !!hd) return;
    this._isHD = !!hd;
    this._log("Switching to", this._isHD ? "HD" : "SD");
    const cam = this._cameraId;
    this.cleanup();
    const pendingGeneration = this._runGeneration;
    this._setState({ loading: true, provider: null, error: null });
    if (cam) {
      this._waitUpdate().then(() =>
        this.start(cam, pendingGeneration)
      );
    }
  }
  toggleHD() { this.setHD(!this._isHD); }

  restart() {
    const cam = this._cameraId;
    if (!cam) return;
    this.cleanup();
    const pendingGeneration = this._runGeneration;
    this._setState({ loading: true, provider: null, error: null });
    this._waitUpdate().then(() =>
      this.start(cam, pendingGeneration)
    );
  }

  switchCamera(cameraId) {
    if (cameraId === this._cameraId) return;
    this.cleanup();
    const pendingGeneration = this._runGeneration;
    this._cameraId = cameraId;
    this._isHD = false;
    this._setState({ loading: true, provider: null, error: null });
    this._waitUpdate().then(() =>
      this.start(cameraId, pendingGeneration)
    );
  }

  /* Cleanup */
  cleanup() {
    this._invalidateRun();
    this._cameraId = null;
    this._proxyRoute = null;
    this._releaseResources();
  }
  _releaseResources() {
    this.muteCameraAudio();
    this.stopAnnouncement();
    this.stopTalk();
    this._cleanupWebRTC();
    this._cleanupMSE();
    this._cleanupGo2rtcWs();
    this._cleanupMJPEG();
    this._clearVideo();
  }
  _clearVideo() {
    const v = this._videoEl();
    if (v) {
      try { v.pause(); } catch {}
      try { v.srcObject = null; } catch {}
      v.removeAttribute("src");
      try { v.load(); } catch {}
    }
  }
  _cleanupMSE() {
    this._mseStream = null;
    if (this._sourceBuffer) {
      try { this._mediaSource?.removeSourceBuffer(this._sourceBuffer); } catch {}
      this._sourceBuffer = null;
    }
    if (this._mediaSource) {
      if (this._mediaSource.readyState === "open") {
        try { this._mediaSource.endOfStream(); } catch {}
      }
      this._mediaSource = null;
    }
    this._mseBuf = null;
    this._mseBufLen = 0;
  }
  _cleanupMJPEG(clearUrl = true) {
    if (this._mjpegRefreshTimer) {
      clearInterval(this._mjpegRefreshTimer);
      this._mjpegRefreshTimer = null;
    }
    if (clearUrl) this._setState({ mjpegUrl: null });
  }
}

// Shared by the single player and multiview. No media is acquired in render or on mount.
class FrigateVisionTalkButton extends LitElement {
  static properties = {
    controller: { attribute: false }, mode: {}, state: {}, messages: { attribute: false },
  };

  connectedCallback() {
    super.connectedCallback();
    this._lifetime = new AbortController();
    const options = { signal: this._lifetime.signal };
    window.addEventListener("pagehide", () => this._stop(), options);
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._stop(); }, options);
    window.addEventListener("blur", () => { if (this.mode === "hold") this._stop(); }, options);
  }
  disconnectedCallback() {
    this._lifetime?.abort();
    this._stop();
    super.disconnectedCallback();
  }
  _stop() {
    this._held = null;
    if (this.controller?.talkRequested) this.controller.stopTalk();
  }
  _down(e) {
    if (this.mode !== "hold" || this._held != null) return;
    if (e.type === "pointerdown") {
      if (!e.isPrimary || e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      this._held = e.pointerId;
    } else {
      if (e.repeat || ![" ", "Enter"].includes(e.key)) return;
      e.preventDefault();
      this._held = e.key;
    }
    this.controller?.startTalk();
  }
  _up(e) {
    if (this._held != null && this._held === (e.pointerId ?? e.key)) {
      e.preventDefault();
      this._stop();
    }
  }
  _click() {
    if (this.mode === "hold") return;
    if (this.controller?.talkRequested) this._stop();
    else this.controller?.startTalk();
  }

  render() {
    const m = this.messages || STRINGS.en.talk;
    const sending = this.state === "sending";
    const busy = sending || this.state === "pending";
    const label = busy && this.mode !== "hold" ? m.stop : this.mode === "hold" ? m.hold : m.toggle;
    return html`<button type="button" aria-label=${label} title=${label} aria-pressed=${sending}
      @click=${this._click} @pointerdown=${this._down} @pointerup=${this._up}
      @pointercancel=${this._up} @lostpointercapture=${this._up}
      @keydown=${this._down} @keyup=${this._up} @blur=${() => { if (this.mode === "hold") this._stop(); }}>
      <ha-icon icon=${sending ? "mdi:microphone" : "mdi:microphone-outline"}></ha-icon>
    </button><span role="status">${m[this.state] || ""}</span>`;
  }
  static styles = css`
    :host { position: relative; display: inline-flex; }
    button { width: 36px; height: 36px; border: none; border-radius: 50%; background: #000a;
      color: white; cursor: pointer; touch-action: none; user-select: none; -webkit-touch-callout: none; }
    button[aria-pressed=true] { background: #ad1818; }
    span { position: absolute; top: calc(100% + 4px); right: 0; width: max-content; max-width: min(160px, 40vw);
      padding: 4px 8px; border-radius: 4px; background: #121212eb; color: white; font: 13px/1.3 sans-serif;
      pointer-events: none; }
    span:empty { display: none; }
  `;
}

function talkButton(controller, config, state, strings) {
  return html`<frigate-vision-talk-button .controller=${controller} .mode=${config?.talk_mode}
    .state=${state} .messages=${strings?.talk}></frigate-vision-talk-button>`;
}

class FrigateVisionCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { state: true },
      _events: { state: true },
      _loading: { state: true },
      _error: { state: true },
      _activeClip: { state: true },
      _clipUrl: { state: true },
      _clipError: { state: true },
      _clipLoading: { state: true },
      _clipSourceKind: { state: true },
      _lightbox: { state: true },
      _totalCap: { state: true },
      _availableCameras: { state: true },
      _resolvedInstanceId: { state: true },
      _activeLabels: { state: true },
      _dateFilter: { state: true },
      _activeCameras: { state: true },
      _showLabelMenu: { state: true },
      _showDateMenu: { state: true },
      _showCameraMenu: { state: true },
      _showLiveCamMenu: { state: true },
      _cardWidth: { state: true },
      _liveMode: { state: true },
      _liveCamera: { state: true },
      _liveError: { state: true },
      _liveProvider: { state: true },
      _liveLoading: { state: true },
      _talkState: { state: true },
      _talkMuted: { state: true },
      _talkAudioBlocked: { state: true },
      _isHD: { state: true },
      _mjpegSignedUrl: { state: true },
      _timelineCamera: { state: true },
      _timelineLoading: { state: true },
      _timelineError: { state: true },
      _timelinePlayerTime: { state: true },
      _timelineHourStart: { state: true },
      _timelineZoomLevel: { state: true },
      _timelineZoomCenter: { state: true },

      _timelineSelected: { state: true },
      _timelineSelectedDay: { state: true },
    };
  }

  constructor() {
    super();
    this._events = [];
    this._frigateApiById = new Map();
    this._loading = false;
    this._error = null;
    this._activeClip = null;
    this._clipUrl = null;
    this._clipError = null;
    this._clipLoading = false;
    this._clipSourceKind = null;
    this._clipLoadToken = 0;
    this._clipAttemptId = 0;
    this._clipResolvedHlsUrl = null;
    this._clipAttemptErrors = [];
    this._clipLateErrorCleanup = null;
    this._clipFailureHandledAttempt = null;
    this._lightbox = null;
    this._totalCap = null;
    this._availableCameras = [];
    this._activeLabels = null;
    this._dateFilter = "all";
    this._activeCameras = null;
    this._showLabelMenu = false;
    this._showDateMenu = false;
    this._showCameraMenu = false;
    this._showLiveCamMenu = false;
    this._cardWidth = 0;
    this._resizeObserver = null;
    this._hls = null;
    this._fetchToken = 0;
    this._hasFetchedOnce = false;
    this._centralProfile = null;
    this._centralProfilePromise = null;
    this._profileLifecycleGeneration = 0;
    this._profileLifecyclePromise = null;
    this._liveMode = false;
    this._liveCamera = null;
    this._liveError = null;
    this._liveProvider = null;
    this._liveLoading = false;
    this._isHD = false;
    this._mjpegSignedUrl = null;
    this._lc = null;
    this._timelineCamera = null;
    this._timelineLoading = false;
    this._timelineError = null;
    this._timelinePlayerTime = 0;
    this._timelineHls = null;
    this._timelineRangeStart = 0;
    this._timelineRangeEnd = 0;
    this._timelineHourStart = 0;
    this._timelinePendingSeekSec = null;
    this._timelineZoomLevel = 1;
    this._timelineZoomCenter = 0;
    this._timelineSelected = false;
    this._timelineSelectedDay = null;  // ms at 00:00 of chosen day; null = rolling window
  }

  connectedCallback() {
    super.connectedCallback();
    console.info(`[FrigateVisionCard] v${CARD_VERSION} connected (iOS=${this._isIOS()}, SafariDesktop=${this._isSafariDesktop()})`);
    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          if (w && w !== this._cardWidth) this._cardWidth = w;
        }
      });
      this.updateComplete.then(() => {
        if (this._resizeObserver && this.isConnected) {
          this._resizeObserver.observe(this);
        }
      });
    }
    this._onHashChange = () => this._checkHashForClip();
    window.addEventListener("hashchange", this._onHashChange);
    this._onLocationChanged = () => this._checkHashForClip();
    window.addEventListener("location-changed", this._onLocationChanged);
    this._onOutsideClick = (e) => this._handleOutsideClick(e);
    document.addEventListener("pointerdown", this._onOutsideClick, true);
    this._setupAutoRefresh();
    if (this.hass && !this._hasFetchedOnce) this.requestUpdate();
  }

  _handleOutsideClick(e) {
    if (
      !this._showLabelMenu &&
      !this._showDateMenu &&
      !this._showCameraMenu &&
      !this._showLiveCamMenu
    ) return;
    const path = e.composedPath();
    const inFilter = path.some(
      (el) => el.classList && el.classList.contains("filter-dropdown")
    );
    if (!inFilter) {
      this._showLabelMenu = false;
      this._showDateMenu = false;
      this._showCameraMenu = false;
      this._showLiveCamMenu = false;
    }
  }

  _setupAutoRefresh() {
    this._clearAutoRefresh();
    const sec = this._config?.auto_refresh_seconds || 0;
    if (sec <= 0 || this._config.view_mode === "doorbell") return;
    this._autoRefreshTimer = setInterval(() => {
      if (!this.isConnected) return;
      if (this._loading) return;
      if (document.hidden) return;
      this._fetchAll();
    }, sec * 1000);
  }

  _clearAutoRefresh() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  }

  firstUpdated() {
    // Attach touch handlers once after the first render, with renderRoot available.
    this._setupIOSTouchFallback();
  }

  _setupIOSTouchFallback() {
    if (this._iosTouchFallbackAttached) return;
    if (typeof navigator === "undefined" || !navigator.maxTouchPoints) return;
    this._iosTouchFallbackAttached = true;
    const INTERACTIVE = [
      "control-btn", "iconbtn", "cam-close", "closebtn",
      "overlay-btn", "filter-btn", "loadmore", "loadless",
    ];
    this.renderRoot.addEventListener("touchend", (e) => {
      const path = e.composedPath();
      const btn = path.find((el) =>
        el.classList && INTERACTIVE.some((cls) => el.classList.contains(cls))
      );
      if (!btn) return;
      e.preventDefault();
      btn.click();
    }, { passive: false });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._profileLifecycleGeneration++;
    this._doorbellProfile = null;
    if (this._loading) {
      ++this._fetchToken;
      this._loading = false;
      this._hasFetchedOnce = false;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._hls) {
      this._hls.destroy();
      this._hls = null;
    }
    this._cleanupLivestream();
    if (this._onHashChange) {
      window.removeEventListener("hashchange", this._onHashChange);
      this._onHashChange = null;
    }
    if (this._onLocationChanged) {
      window.removeEventListener("location-changed", this._onLocationChanged);
      this._onLocationChanged = null;
    }
    if (this._onOutsideClick) {
      document.removeEventListener("pointerdown", this._onOutsideClick, true);
      this._onOutsideClick = null;
    }
    this._clearAutoRefresh();
    this._cleanupTimeline();
  }

  _parseClipHash() {
    const hash = (window.location.hash || "").replace(/^#/, "");
    if (!hash) return null;
    for (const part of hash.split("&")) {
      const [k, v] = part.split("=");
      if (k === "frigate_vision_clip" && v) return decodeURIComponent(v);
    }
    return null;
  }

  _checkHashForClip() {
    if (this._config?.view_mode === "doorbell") return;
    const wantedId = this._parseClipHash();
    if (!wantedId) return;
    if (this._activeClip && this._activeClip._eventId === wantedId) return;
    const events = this._events || [];
    const match = events.find((ev) => ev._eventId === wantedId);
    if (match) this._openClip(match);
  }

  _isSplitLayout() {
    const lay = this._config?.multiview
      ? (this._config.multiview_layout || "auto")
      : (this._config?.layout ?? "auto");
    if (lay === "split") return true;
    if (lay === "stacked") return false;
    return this._cardWidth >= (this._config?.desktop_breakpoint || 800);
  }

  _cssSize(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") return `${value}px`;
    const raw = String(value).trim();
    if (!raw || raw.toLowerCase() === "auto") return null;
    if (raw.toLowerCase() === "full") return "100%";
    if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}px`;
    return raw;
  }

  _isPercentSize(value) {
    return typeof value === "string" && /^\d+(\.\d+)?%$/.test(value.trim());
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid config");
    if (this._lc?.talkRequested) this._lc.stopTalk();
    this._lc?.stopAnnouncement?.();
    const initial = Number(config.initial_events) || Number(config.clips_per_load) || 10;
    const configuredProfileEntryId =
      typeof config.frigate_vision_entry_id === "string" &&
      config.frigate_vision_entry_id.trim()
        ? config.frigate_vision_entry_id.trim()
        : null;
    const previousView = this._config?.view_mode;
    const previousClientId = this._config?.frigate_client_id;
    const previousDedupeWindow = this._config?.dedupe_window_seconds;
    const previousProfileEntryId =
      this._config?.frigate_vision_entry_id || null;
    const profileEntryChanged =
      this._config &&
      previousProfileEntryId !== configuredProfileEntryId;
    if (profileEntryChanged) {
      this._centralProfile = null;
      this._centralProfilePromise = null;
    }
    const previousAutoInstance = !profileEntryChanged && !this._go2rtcOverrides?.clientId
      ? this._resolvedInstanceId : null;
    this._go2rtcOverrides = {
      internal: Boolean(config.go2rtc_url),
      external: Boolean(config.go2rtc_url_external),
      modes: Boolean(sanitizeGo2rtcModes(config.go2rtc_modes)),
      clientId: Boolean(
        typeof config.frigate_client_id === "string"
          ? config.frigate_client_id.trim()
          : config.frigate_client_id
      ),
    };
    const profile = this._centralProfile || {};
    const profileInternalUrl =
      profile.go2rtc_url || profile.go2rtc_internal_url || profile.internal_url || null;
    const profileExternalUrl =
      profile.go2rtc_url_external ||
      profile.go2rtc_external_url ||
      profile.external_url ||
      null;
    const profileClientId =
      typeof profile.frigate_client_id === "string" &&
      profile.frigate_client_id.trim()
        ? profile.frigate_client_id.trim()
        : null;
    const configuredClientId =
      typeof config.frigate_client_id === "string" &&
      config.frigate_client_id.trim()
        ? config.frigate_client_id.trim()
        : null;
    const directGo2rtcOverride = Boolean(
      config.go2rtc_url ||
      config.go2rtc_url_external ||
      config.frigate_url ||
      profileInternalUrl ||
      profileExternalUrl
    );
    // The legacy live proxy can try "frigate" by default. A PTZ write must
    // wait for an explicit client, the selected profile, or a unique Clips root.
    this._resolvedInstanceId = configuredClientId || profileClientId || previousAutoInstance || null;
    this._config = {
      title: config.title ?? "auto",
      title_icon: config.title_icon || null,
      cameras: FrigateVisionCard._normalizeCamerasMap(config),
      frigate_vision_entry_id: configuredProfileEntryId,
      frigate_client_id: this._resolvedInstanceId || "frigate",
      initial_events: initial,
      events_per_load: Number(config.events_per_load) || Number(config.clips_per_load) || 10,
      section_mode: config.section_mode === true,
      height: config.height ?? config.max_height ?? "auto",
      mobile_height: config.mobile_height ?? null,
      desktop_height: config.desktop_height ?? null,
      width: config.width ?? config.card_width ?? "auto",
      layout: config.layout ?? "auto",
      desktop_breakpoint: Number(config.desktop_breakpoint) || 800,
      show_filters: config.show_filters !== false,
      show_title: config.show_title !== false,
      language: config.language ?? "auto",
      label_colors:
        config.label_colors && typeof config.label_colors === "object"
          ? config.label_colors
          : null,
      label_icons:
        config.label_icons && typeof config.label_icons === "object"
          ? config.label_icons
          : null,
      label_style: ["soft", "solid", "outline"].includes(config.label_style)
        ? config.label_style
        : "soft",
      prefer_mp4_cameras: Array.isArray(config.prefer_mp4_cameras)
        ? config.prefer_mp4_cameras
            .map((c) => String(c || "").trim().toLowerCase())
            .filter(Boolean)
        : [],
      live_provider: VALID_LIVE_PROVIDERS.includes(config.live_provider)
        ? config.live_provider
        : "auto",
      go2rtc_modes:
        sanitizeGo2rtcModes(config.go2rtc_modes) ||
        sanitizeGo2rtcModes(profile.go2rtc_modes) ||
        DEFAULT_GO2RTC_MODES,
      frigate_url: config.frigate_url ?? null,
      go2rtc_url: config.go2rtc_url || profileInternalUrl,
      go2rtc_url_external: config.go2rtc_url_external || profileExternalUrl,
      _go2rtc_direct_override: directGo2rtcOverride,
      live_camera: config.live_camera
        ? String(config.live_camera).trim().toLowerCase()
        : null,
      dedupe_window_seconds: normalizeDedupeWindow(config.dedupe_window_seconds),
      auto_refresh_seconds: Math.max(0, Number(config.auto_refresh_seconds) || 0),
      show_live_button: config.show_live_button !== false,
      live_autostart: config.live_autostart !== false,
      live_controls: config.live_controls !== false,
      talk_mode: config.talk_mode === "hold" ? "hold" : "toggle",
      live_controls_position: ["top", "bottom"].includes(config.live_controls_position) ? config.live_controls_position : "bottom",
      hd_sd_button: config.hd_sd_button !== false,
      hd_sd_button_position: ["top", "bottom"].includes(config.hd_sd_button_position) ? config.hd_sd_button_position : "top",
      multiview: config.multiview === true,
      multiview_layout: ["split", "stacked", "auto"].includes(config.multiview_layout) ? config.multiview_layout : "auto",
      multiview_columns_mobile: FrigateVisionCard._normalizeColumnCount(
        config.multiview_columns_mobile,
        1
      ),
      multiview_columns_desktop: FrigateVisionCard._normalizeColumnCount(
        config.multiview_columns_desktop,
        1
      ),
      view_mode: ["events", "timeline", "doorbell"].includes(config.view_mode) ? config.view_mode : "events",
      doorbell_camera: editorString(config.doorbell_camera).toLowerCase(),
      doorbell_ring_on_mount: config.doorbell_ring_on_mount === true,
      timeline_window_hours: Math.max(1, Math.min(168, Number(config.timeline_window_hours) || 24)),
      timeline_flipped: config.timeline_flipped === true,
    };
    // Timeline + Multiview schließen sich aus — Multiview hat Vorrang
    if (this._config.multiview && this._config.view_mode === "timeline") {
      this._config.view_mode = "events";
    }
    this._totalCap = this._config.initial_events;
    if (this.isConnected) this._setupAutoRefresh();
    const doorbell = this._config.view_mode === "doorbell";
    if (doorbell !== (previousView === "doorbell")) {
      // Finish old-mode work before the new view mounts its own single player.
      ++this._fetchToken;
      ++this._profileLifecycleGeneration;
      this._profileLifecyclePromise = null;
      this._hasFetchedOnce = this._liveAutostarted = this._loading = false;
      if (this._activeClip) this._disposeActiveClip();
      if (this._timelineCamera || this._timelineHls) this._cleanupTimeline();
      this._timelineCamera = null;
      if (this._liveMode) this._closeLive();
    }
    this._doorbellProfile = null;
    if (doorbell) {
      this._doorbellViewError = doorbellViewError(config, this._config.cameras, this._config.doorbell_camera);
      return;
    }
    if ((profileEntryChanged || (previousClientId && previousClientId !== this._config.frigate_client_id)) && this.isConnected && this.hass?.callWS) {
      this._events = [];
      this._availableCameras = [];
      this._frigateApiById = new Map();
      if (this._activeClip) this._disposeActiveClip();
      this._startProfileLifecycle({ restartLive: true });
      this._fetchAll();
    } else if (this.isConnected && this.hass?.callWS && this._hasFetchedOnce &&
               previousDedupeWindow !== this._config.dedupe_window_seconds) {
      this._fetchAll();
    }
  }

  static _normalizeColumnCount(value, fallback = 1) {
    const fb = Number(fallback);
    const safeFallback =
      Number.isFinite(fb) && fb > 0 ? Math.max(1, Math.min(4, Math.round(fb))) : 1;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return safeFallback;
    return Math.max(1, Math.min(4, Math.round(n)));
  }

  static _normalizeCamerasMap(config) {
    const map = {};
    const put = (id, value) => {
      const key = String(id).toLowerCase();
      const prev = Object.hasOwn(map, key) ? map[key] : { name: "", main: null, sub: null, ultra_wide: false };
      if (value == null && Object.hasOwn(map, key)) return;
      const { name, main, sub, ultra_wide, doorbell, ...extra } = value || {};
      const entry = {
        ...prev, ...extra,
        name: name ? String(name) : prev.name,
        main: main ? String(main) : prev.main,
        sub: sub ? String(sub) : prev.sub,
        ultra_wide: ultra_wide === true,
      };
      if (doorbell !== undefined) entry.doorbell = normalizeDoorbell(doorbell);
      Object.defineProperty(map, key, { value: entry, enumerable: true, configurable: true, writable: true });
    };

    const c = config.cameras;
    if (c && typeof c === "object" && !Array.isArray(c)) {
      for (const [id, value] of Object.entries(c)) put(id, value && typeof value === "object" ? value : undefined);
    } else if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === "string") { put(item); continue; }
        if (item && typeof item === "object") {
          const { id, ...fields } = item;
          if (id) put(id, fields);
          else if (Object.keys(item).length === 1) {
            const [[key, value]] = Object.entries(item);
            put(key, value && typeof value === "object" ? value : undefined);
          }
        }
      }
    } else if (typeof c === "string" && c.toLowerCase() !== "all" && c.trim()) {
      put(c);
    }

    return map;
  }

  get _t() {
    const lang = detectLang(this.hass, this._config?.language);
    return STRINGS[lang];
  }

  _camEntry(camName) {
    if (!camName) return null;
    return this._config?.cameras?.[String(camName).toLowerCase()] || null;
  }

  _camName(raw) {
    if (!raw) return "";
    const entry = this._camEntry(raw);
    if (entry?.name) return entry.name;
    return humanizeIdentifier(String(raw));
  }

  _go2rtcStreamFor(camId, hd) {
    const entry = this._camEntry(camId) || {};
    if (hd && entry.main) return entry.main;
    if (!hd && entry.sub) return entry.sub;
    return entry.main || entry.sub || camId;
  }

  _configuredCameraIds() {
    const keys = Object.keys(this._config?.cameras || {});
    return keys;
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return {
      columns: 12,
      rows: "auto",
      min_columns: 6,
      min_rows: 4,
    };
  }

  getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_rows: "auto",
      grid_min_columns: 2,
      grid_min_rows: 3,
    };
  }

  async _loadCentralProfile() {
    if (this._centralProfilePromise) return this._centralProfilePromise;
    const requestedEntryId =
      this._config?.frigate_vision_entry_id || null;
    const request = Promise.resolve().then(async () => {
        const profileMessage = {
          type: "frigate_vision/profile",
        };
        if (this._config?.frigate_vision_entry_id) {
          profileMessage.entry_id = this._config.frigate_vision_entry_id;
        }
        const response = await this.hass.callWS(profileMessage);
        if (
          (this._config?.frigate_vision_entry_id || null) !==
          requestedEntryId
        ) {
          throw new Error("Frigate Vision profile selection changed");
        }
        const profile = response?.profile || response;
        if (!profile || typeof profile !== "object") {
          throw new Error("Invalid Frigate Vision profile response");
        }
        this._centralProfile = profile;
        // Re-resolve only fields that were not explicitly set on the card.
        const current = this._config || {};
        const internalUrl =
          profile.go2rtc_url ||
          profile.go2rtc_internal_url ||
          profile.internal_url ||
          null;
        const externalUrl =
          profile.go2rtc_url_external ||
          profile.go2rtc_external_url ||
          profile.external_url ||
          null;
        const modes = sanitizeGo2rtcModes(profile.go2rtc_modes);
        const profileClientId =
          typeof profile.frigate_client_id === "string" &&
          profile.frigate_client_id.trim()
            ? profile.frigate_client_id.trim()
            : null;
        const overrides = this._go2rtcOverrides || {};
        const resolvedInternalUrl = overrides.internal
          ? current.go2rtc_url
          : internalUrl || null;
        const resolvedExternalUrl = overrides.external
          ? current.go2rtc_url_external
          : externalUrl || null;
        if (!overrides.clientId && profileClientId) this._resolvedInstanceId = profileClientId;
        const next = {
          ...current,
          frigate_client_id: this._resolvedInstanceId || "frigate",
          go2rtc_url: resolvedInternalUrl,
          go2rtc_url_external: resolvedExternalUrl,
          _go2rtc_direct_override: Boolean(
            current.frigate_url ||
            resolvedInternalUrl ||
            resolvedExternalUrl
          ),
          go2rtc_modes: overrides.modes
            ? current.go2rtc_modes
            : modes || current.go2rtc_modes || DEFAULT_GO2RTC_MODES,
        };
        if (
          next.go2rtc_url !== current.go2rtc_url ||
          next.go2rtc_url_external !== current.go2rtc_url_external ||
          next.frigate_client_id !== current.frigate_client_id ||
          next._go2rtc_direct_override !== current._go2rtc_direct_override ||
          next.go2rtc_modes !== current.go2rtc_modes
        ) {
          this._config = next;
          this.requestUpdate();
        }
        return profile;
    });
    let managedPromise;
    managedPromise = request.catch(() => {
      // The integration/profile is optional. Do not cache transient or
      // multi-entry selection errors so a later retry can recover.
      if (this._centralProfilePromise === managedPromise) {
        this._centralProfilePromise = null;
      }
      return null;
    });
    this._centralProfilePromise = managedPromise;
    const result = await managedPromise;
    if (result === null && this._centralProfilePromise === managedPromise) {
      this._centralProfilePromise = null;
    }
    return result;
  }

  _waitForProfileRetry() {
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  async _loadCentralProfileWithRetry(expectedEntryId, lifecycleGeneration) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (
        lifecycleGeneration !== this._profileLifecycleGeneration ||
        (this._config?.frigate_vision_entry_id || null) !== expectedEntryId ||
        !this.isConnected
      ) return null;
      const profile = await this._loadCentralProfile();
      if (
        lifecycleGeneration !== this._profileLifecycleGeneration ||
        (this._config?.frigate_vision_entry_id || null) !== expectedEntryId ||
        !this.isConnected
      ) return null;
      if (profile) return profile;
      if (attempt === 0) await this._waitForProfileRetry();
    }
    return null;
  }

  _restartProfileBackedLive() {
    if (this._liveMode && this._liveCamera) {
      this._liveLoading = true;
      this._liveProvider = null;
      this._liveError = null;
      this._ensureLivestreamController().restart();
    }
    if (this._config?.multiview) {
      this.updateComplete.then(() => {
        const tiles =
          this.renderRoot?.querySelectorAll("frigate-vision-live-tile");
        if (tiles) tiles.forEach((tile) => tile._restart());
      });
    }
  }

  _startProfileLifecycle({ restartLive = false } = {}) {
    const lifecycleGeneration = ++this._profileLifecycleGeneration;
    const expectedEntryId =
      this._config?.frigate_vision_entry_id || null;
    const profilePromise = this._loadCentralProfileWithRetry(
      expectedEntryId,
      lifecycleGeneration
    ).then((profile) => {
      if (
        (profile || this._go2rtcOverrides?.clientId) &&
        restartLive &&
        lifecycleGeneration === this._profileLifecycleGeneration &&
        this.isConnected
      ) {
        this._restartProfileBackedLive();
      }
      return profile;
    });
    this._profileLifecyclePromise = profilePromise;
    return profilePromise;
  }

  _maybeStartAutoLive() {
    if (this._config.view_mode === "doorbell") return;
    const inTimelineMode = this._config.view_mode === "timeline";
    // Timeline-Mode mit unausgewählter Position verhält sich wie Events-Ansicht (Live)
    const allowAutoLive = !this._config.multiview
      && (!inTimelineMode || !this._timelineSelected);
    if (allowAutoLive
        && this._config.live_autostart
        && !this._liveMode
        && !this._liveAutostarted) {
      this._liveAutostarted = true;
      const preferred = this._resolveLiveCamera();
      if (preferred) this._openLive(preferred);
    }
  }

  updated(changed) {
    if (this._config?.view_mode === "doorbell") {
      this._loadDoorbellViewProfile();
      return;
    }
    if (this.isConnected && this.hass && this._config && !this._hasFetchedOnce && !this._loading) {
      this._hasFetchedOnce = true;
      const profilePromise = this._startProfileLifecycle();
      this._fetchAll();
      profilePromise.finally(() => {
        if (
          this._profileLifecyclePromise === profilePromise &&
          this.isConnected
        ) this._maybeStartAutoLive();
      });
    }
    if (
      (changed.has("_clipUrl") || changed.has("_clipSourceKind")) &&
      this._clipUrl
    ) {
      this.updateComplete.then(() => this._initPlayer());
    }
    if (this._config?.view_mode === "timeline") {
      const desiredCam = this._resolveTimelineCamera();
      if (desiredCam) {
        const camChanged = desiredCam !== this._timelineCamera;
        // Lazy-Reinit: VoD-Player erst laden, wenn eine Position ausgewählt ist
        // und kein Clip im Vordergrund läuft (z.B. nach Clip schließen).
        const needsVodLoad = this._timelineSelected
          && !this._activeClip
          && !this._timelineHls
          && !this._timelineLoading;
        if (camChanged || needsVodLoad) {
          this._initTimeline();
        }
      }
    } else if (this._timelineHls) {
      this._cleanupTimeline();
    }
  }

  _loadDoorbellViewProfile() {
    if (!this.isConnected || this._doorbellViewError || !this.hass?.callWS || this.hass.connected === false) return;
    const connection = this.hass.connection || this.hass.callWS;
    if (this._doorbellProfile?.connection === connection) return;
    const lookup = this._doorbellProfile = { connection, ready: false };
    this._loadCentralProfile().then(profile => {
      if (lookup !== this._doorbellProfile || !this.isConnected) return;
      lookup.profile = profile;
      lookup.ready = true;
      this.requestUpdate();
    });
  }

  _renderDoorbellView() {
    const config = this._config;
    const camera = config.doorbell_camera;
    const t = this._t;
    const messages = DOORBELL_VIEW_MESSAGES[detectLang(this.hass, config.language)] || DOORBELL_VIEW_MESSAGES.en;
    const error = key => html`<ha-card class="doorbell-view doorbell-message"><p role="alert">${messages[key]}</p></ha-card>`;
    if (this._doorbellViewError) return error(this._doorbellViewError);
    const lookup = this._doorbellProfile;
    if (!lookup?.ready) return html`<ha-card class="doorbell-view doorbell-message"><p role="status">${t.live_connecting}</p></ha-card>`;
    const groups = frigateCameraGroups(this.hass);
    let client = this._go2rtcOverrides.clientId ? config.frigate_client_id : editorString(lookup.profile?.frigate_client_id);
    if (config.frigate_vision_entry_id && (!lookup.profile?.frigate_client_id || lookup.profile.frigate_client_id !== client)) return error("profile");
    if (!client) {
      // Use only metadata for the exact selected camera, not event discovery or a default NVR guess.
      const matches = [...groups].filter(([, cameras]) => cameras.has(camera));
      if (matches.length > 1) return error("ambiguous");
      client = matches[0]?.[0];
    }
    const match = groups.get(client)?.get(camera);
    if (!match) return error("unavailable");
    if (match.ambiguous) return error("ambiguous");
    // Keep the child configuration stable on hass updates and container resizes.
    if (this._doorbellTile?.source !== config || this._doorbellTile.client !== client) {
      this._doorbellTile = { source: config, client, config: { ...config, frigate_client_id: client, live_controls: true } };
    }
    const height = this._cssSize(config.height);
    const width = this._cssSize(config.width);
    return html`<ha-card class="doorbell-view" style=${`${config.section_mode ? "height:100%;" : height ? `height:${height};` : ""}${!config.section_mode && width ? `max-width:${width};` : ""}`}>
      <frigate-vision-live-tile .hass=${this.hass} .cameraId=${camera} .cameraEntry=${config.cameras[camera]}
        .instanceId=${client} .cardConfig=${this._doorbellTile.config} .t=${t} .doorbellOnly=${true}></frigate-vision-live-tile>
    </ha-card>`;
  }

  async _fetchAll() {
    if (this._config?.view_mode === "doorbell") return;
    const token = ++this._fetchToken;
    this._loading = true;
    this._error = null;
    try {
      await this._profileLifecyclePromise;
      if (token !== this._fetchToken) return;
      const requestedId = this._go2rtcOverrides?.clientId || this._centralProfile?.frigate_client_id
        ? this._config.frigate_client_id : null;
      if (this._config.frigate_vision_entry_id && !requestedId) {
        throw new Error("Die gewählte Frigate-Vision-Instanz konnte nicht zugeordnet werden.");
      }
      const root = await this.hass.callWS({ type: "media_source/browse_media", media_content_id: "media-source://frigate" });
      if (token !== this._fetchToken) return;
      const { folder, id } = selectClipsRoot(root.children, requestedId);
      this._resolvedInstanceId = id || null;
      const clientId = id || "frigate";
      if (this._config.frigate_client_id !== clientId) {
        this._config = { ...this._config, frigate_client_id: clientId };
        // A standalone live player may already be trying the legacy default.
        // Multiview tiles restart themselves when cardConfig changes.
        if (this._liveMode && !this._config.multiview) this._lc?.restart();
      }
      const [{ events, cameras }, frigateApiEvents] = await Promise.all([
        this._fetchFrigateEvents(folder).then(media => {
          // On first load the list is useful as soon as the media source
          // responds. On refresh retain the enriched rows until replacement.
          if (token === this._fetchToken && !this._events.length && media.events.length) {
            this._availableCameras = media.cameras;
            this._events = media.events;
          }
          return media;
        }),
        this._fetchFrigateApiEvents(clientId),
      ]);
      if (token !== this._fetchToken) return;
      this._frigateApiById = new Map(
        (frigateApiEvents || []).map((e) => [e.id, e])
      );
      this._availableCameras = cameras;
      this._events = this._enrichEvents([...events]);
      this._checkHashForClip();
    } catch (e) {
      if (token === this._fetchToken) this._error = e.message || String(e);
    } finally {
      if (token === this._fetchToken) this._loading = false;
    }
  }

  async _fetchFrigateEvents(clipsRoot) {
    const ws = (args) => this.hass.callWS(args);
    const targetCams = this._getTargetCameras();

    const content = await ws({
      type: "media_source/browse_media",
      media_content_id: clipsRoot.media_content_id,
    });
    const searchPrefix = clipsRoot.media_content_id.replace(/\/+$/, "") + "/";
    const instancePrefix = searchPrefix.slice(0, -"event-search/clips/".length);
    const eventPrefix = `${instancePrefix}event/clips/`;
    const knownCameras = Object.keys(this.hass?.states || {})
      .filter(key => key.startsWith("camera."))
      .map(key => key.slice("camera.".length));
    const matchesCamera = name => name && (targetCams === "all" || targetCams.includes(name));
    const discovered = new Set();
    const all = [];
    const addClip = (c, camName) => {
      const embedded = this._embeddedFrigateEvent(c);
      c._camera = embedded?.camera || camName;
      c._eventId = embedded?.id || parseFrigateEventId(c.media_content_id);
      const meta = parseClipMeta(c.title, c._eventId);
      c._ts = embedded?.startTime ? new Date(embedded.startTime * 1000) : meta.ts;
      c._label = embedded?.label || meta.label;
      c._hasClip = embedded?.hasClip ?? null;
      if (embedded) c._frigate = embedded;
      all.push(c);
    };

    for (const item of content.children || []) {
      // A small library may return playable clips directly, with no drilldown.
      if (item.media_content_id?.startsWith(eventPrefix) && !item.can_expand) {
        const [camera, eventId] = item.media_content_id.slice(eventPrefix.length).split("/");
        if (eventId && matchesCamera(camera.toLowerCase())) {
          discovered.add(camera.toLowerCase());
          addClip(item, camera);
        }
        continue;
      }
      const camera = cameraForClipFolder(item, searchPrefix, instancePrefix, knownCameras);
      if (!matchesCamera(camera)) continue;
      discovered.add(camera);
      const clips = [];
      await this._walkCamera(item, clips, Math.max(this._totalCap * 3, 24));
      for (const clip of clips) addClip(clip, camera);
    }

    all.sort((a, b) => {
      const ta = a._ts ? a._ts.getTime() : 0;
      const tb = b._ts ? b._ts.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.title || "").localeCompare(a.title || "");
    });

    const dedupeWindow = this._config.dedupe_window_seconds * 1000;
    const seenIds = new Set();
    const seenBuckets = new Map();
    const deduped = [];
    for (const ev of all) {
      const id = ev._eventId;
      if (id && seenIds.has(id)) continue;

      const tsMs = ev._ts ? ev._ts.getTime() : null;
      const bucketKey = `${ev._camera}|${ev._label || ""}`;
      if (tsMs != null && dedupeWindow > 0) {
        const prevTs = seenBuckets.get(bucketKey);
        if (prevTs != null && Math.abs(prevTs - tsMs) <= dedupeWindow) {
          continue;
        }
        seenBuckets.set(bucketKey, tsMs);
      } else if (!id || dedupeWindow > 0) {
        const fk = `${bucketKey}|${ev.title}`;
        if (seenBuckets.has(fk)) continue;
        seenBuckets.set(fk, 0);
      }

      if (id) seenIds.add(id);
      deduped.push(ev);
    }

    return { events: deduped.slice(0, this._totalCap), cameras: [...discovered].sort() };
  }

  async _walkCamera(folder, collection, limit) {
    const ws = (args) => this.hass.callWS(args);
    const content = await ws({
      type: "media_source/browse_media",
      media_content_id: folder.media_content_id,
    });
    if (!content.children?.length) return;
    const hasDateSubfolders = content.children[0].can_expand;
    if (hasDateSubfolders) {
      const sorted = content.children
        .slice()
        .sort((a, b) => (b.title || "").localeCompare(a.title || ""));
      for (const dateFolder of sorted) {
        if (collection.length >= limit) break;
        const dateContent = await ws({
          type: "media_source/browse_media",
          media_content_id: dateFolder.media_content_id,
        });
        const sortedClips = (dateContent.children || [])
          .slice()
          .sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        for (const c of sortedClips) {
          if (collection.length >= limit) break;
          if (!c.can_expand) collection.push(c);
        }
      }
    } else {
      const sorted = content.children
        .slice()
        .sort((a, b) => (b.title || "").localeCompare(a.title || ""));
      for (const c of sorted) {
        if (collection.length >= limit) break;
        if (!c.can_expand) collection.push(c);
      }
    }
  }

  async _fetchFrigateApiEvents(clientId) {
    if (!this.hass) return [];
    try {
      const after = Math.floor((Date.now() - 7 * 24 * 3600 * 1000) / 1000);
      const msg = {
        type: "frigate/events/get",
        instance_id: clientId,
        limit: 200,
        has_clip: true,
        after,
      };
      console.info("[FrigateVisionCard] Frigate events WS query:", msg);
      const [rawEvents, rawReviews] = await Promise.all([
        this.hass.callWS(msg),
        this.hass
          .callWS({
            type: "frigate/reviews/get",
            instance_id: msg.instance_id,
            limit: 200,
            after,
          })
          .catch((e) => {
            console.warn(
              "[FrigateVisionCard] Frigate reviews WS fetch failed (ignored):",
              e
            );
            return [];
          }),
      ]);
      const items = this._parseFrigateWsArray(rawEvents);
      const reviews = this._parseFrigateWsArray(rawReviews);
      const eventToReview = new Map();
      const text = value => typeof value === "string" ? value.trim() : "";
      for (const r of reviews) {
        let rData = r?.data;
        if (typeof rData === "string") {
          try { rData = JSON.parse(rData); } catch { continue; }
        }
        const detections = rData?.detections || rData?.events;
        if (!Array.isArray(detections)) continue;
        const meta = rData?.metadata || {};
        const reviewMeta = {
          title: text(meta.title),
          summary: text(meta.shortSummary) || text(meta.short_summary),
          scene: text(meta.scene),
          severity: r?.severity || "",
          threatLevel:
            typeof meta.potential_threat_level === "number"
              ? meta.potential_threat_level
              : null,
        };
        if (
          !reviewMeta.title &&
          !reviewMeta.summary &&
          !reviewMeta.scene
        )
          continue;
        for (const eid of detections) {
          if (typeof eid === "string" && !eventToReview.has(eid)) eventToReview.set(eid, reviewMeta);
        }
      }

      const mapped = items.filter(e => typeof e?.id === "string" && e.id).map((e) => {
        const eventDesc = text(e.data?.description);
        const review = eventToReview.get(e.id) || null;
        return {
          id: e.id || "",
          camera: e.camera || "",
          label: e.label || "",
          subLabel: e.sub_label || "",
          description: eventDesc,
          hasClip:
            typeof e.has_clip === "boolean" ? e.has_clip : null,
          startTime:
            Number.isFinite(Number(e.start_time))
              ? Number(e.start_time)
              : null,
          endTime:
            Number.isFinite(Number(e.end_time))
              ? Number(e.end_time)
              : null,
          reviewTitle: review?.title || "",
          reviewSummary: review?.summary || "",
          reviewScene: review?.scene || "",
          severity: review?.severity || "",
          threatLevel: review?.threatLevel ?? null,
        };
      });
      const withTitle = mapped.filter((m) => m.reviewTitle).length;
      const withScene = mapped.filter((m) => m.reviewScene).length;
      console.info(
        `[FrigateVisionCard] Frigate enriched: ${items.length} events, ${reviews.length} reviews, ${eventToReview.size} event ids covered → ${withTitle} events get a review title, ${withScene} get a scene`
      );
      return mapped;
    } catch (e) {
      console.warn("[FrigateVisionCard] Frigate events WS fetch failed (ignored):", e);
      return [];
    }
  }

  _parseFrigateWsArray(raw) {
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  }

  _embeddedFrigateEvent(mediaItem) {
    const raw = mediaItem?.frigate?.event;
    if (!raw || typeof raw !== "object") return null;
    let data = raw.data || {};
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    const id = String(raw.id || "").trim();
    if (!id) return null;
    const numberOrNull = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      id,
      camera: String(raw.camera || "").trim(),
      label: String(raw.label || "").trim(),
      subLabel: String(raw.sub_label || "").trim(),
      description: String(data?.description || "").trim(),
      hasClip:
        typeof raw.has_clip === "boolean" ? raw.has_clip : null,
      startTime: numberOrNull(raw.start_time),
      endTime: numberOrNull(raw.end_time),
      reviewTitle: "",
      reviewSummary: "",
      reviewScene: "",
      severity: "",
      threatLevel: null,
    };
  }

  _enrichEvents(frigateEvents) {
    if (this._frigateApiById?.size) {
      let matched = 0;
      for (const ev of frigateEvents) {
        const f = this._frigateApiById.get(ev._eventId);
        if (f) {
          const embedded = ev._frigate || {};
          const merged = {
            ...embedded,
            ...f,
            camera:
              String(f.camera || "").trim() ||
              String(embedded.camera || "").trim(),
            label:
              String(f.label || "").trim() ||
              String(embedded.label || "").trim(),
            subLabel:
              String(f.subLabel || "").trim() ||
              String(embedded.subLabel || "").trim(),
            description:
              String(f.description || "").trim() ||
              String(embedded.description || "").trim(),
            hasClip: f.hasClip ?? embedded.hasClip ?? null,
            startTime: f.startTime ?? embedded.startTime ?? null,
            endTime: f.endTime ?? embedded.endTime ?? null,
          };
          ev._frigate = merged;
          ev._hasClip = merged.hasClip;
          if (typeof merged.label === "string" && merged.label.trim()) {
            ev._label = merged.label.trim();
          }
          if (typeof merged.camera === "string" && merged.camera.trim()) {
            ev._camera = merged.camera.trim();
          }
          if (merged.startTime) {
            ev._ts = new Date(merged.startTime * 1000);
          }
          matched++;
        }
      }
      const sampleIds = frigateEvents.slice(0, 3).map((e) => e._eventId);
      const apiIds = Array.from(this._frigateApiById.keys()).slice(0, 3);
      console.info(
        `[FrigateVisionCard] Enrich: ${matched}/${frigateEvents.length} timeline events matched Frigate API by id`,
        { timelineSampleIds: sampleIds, apiSampleIds: apiIds }
      );
    } else {
      console.info("[FrigateVisionCard] Enrich: no Frigate API events to merge");
    }
    return frigateEvents;
  }

  _snapshotUrl(ev) {
    const id = ev._eventId;
    const clientId = this._config.frigate_client_id;
    if (id) {
      return `/api/frigate/${clientId}/notifications/${id}/snapshot.jpg?bbox=1`;
    }
    return ev.thumbnail || null;
  }

  async _signMediaPath(url, expires = 300) {
    if (!url) return url;
    const runtimeOrigin =
      window.location?.origin ||
      `${window.location?.protocol || "http:"}//${window.location?.hostname || "localhost"}`;
    let parsed;
    try {
      parsed = new URL(url, runtimeOrigin);
    } catch {
      return url;
    }
    if (parsed.searchParams.has("authSig")) return url;
    if (parsed.origin !== runtimeOrigin) return url;
    const path = `${parsed.pathname}${parsed.search}`;
    const result = await this.hass.callWS({
      type: "auth/sign_path",
      path,
      expires,
    });
    if (!result?.path) {
      throw new Error("Frigate-Medienpfad konnte nicht signiert werden.");
    }
    return result.path;
  }

  _directClipMp4Url(ev) {
    const eventId = ev?._eventId || parseFrigateEventId(ev?.media_content_id);
    if (!eventId) return null;
    const clientId = this._config?.frigate_client_id;
    return clientId
      ? `/api/frigate/${clientId}/notifications/${eventId}/clip.mp4`
      : `/api/frigate/notifications/${eventId}/clip.mp4`;
  }

  _boundedRecordingMp4Url(sourceUrl) {
    if (!sourceUrl) return null;
    try {
      const u = new URL(sourceUrl, window.location.origin);
      const match =
        u.pathname.match(
          /^\/api\/frigate\/([^/]+)\/vod\/(.+?)\/start\/([.0-9]+)\/end\/([.0-9]+)\/index\.m3u8$/i
        ) ||
        u.pathname.match(
          /^\/api\/frigate\/vod\/(.+?)\/start\/([.0-9]+)\/end\/([.0-9]+)\/index\.m3u8$/i
        );
      if (!match) return null;

      const startTs = parseFloat(match.length === 5 ? match[3] : match[2]);
      const endTs = parseFloat(match.length === 5 ? match[4] : match[3]);
      if (endTs - startTs > 120) {
        console.info("[FrigateVisionCard] Bounded recording too long (%ss), skipping", Math.round(endTs - startTs));
        return null;
      }

      if (match.length === 5) {
        const [, instanceId, camera, start, end] = match;
        return `/api/frigate/${instanceId}/recording/${camera}/start/${start}/end/${end}`;
      }

      const [, camera, start, end] = match;
      return `/api/frigate/recording/${camera}/start/${start}/end/${end}`;
    } catch {
      return null;
    }
  }

  _boundedRecordingMp4UrlFromEvent(ev) {
    if (!ev) return null;
    const metadata = ev._frigate || {};
    const camera = String(metadata.camera || ev._camera || "").trim();
    if (!camera) return null;

    const timestampSeconds =
      ev._ts instanceof Date && Number.isFinite(ev._ts.getTime())
        ? ev._ts.getTime() / 1000
        : null;
    const optionalNumber = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    let start = optionalNumber(metadata.startTime);
    if (!Number.isFinite(start)) start = timestampSeconds;
    if (!Number.isFinite(start)) return null;

    let end = optionalNumber(metadata.endTime);
    if (!Number.isFinite(end) || end <= start) end = start + 30;
    end = Math.min(end, start + 120);

    const cleanTimestamp = (value) =>
      String(Math.round(value * 1000) / 1000);
    const clientId = String(
      this._config?.frigate_client_id || ""
    ).trim();
    const proxyPrefix = clientId
      ? `/api/frigate/${encodeURIComponent(clientId)}`
      : "/api/frigate";
    return (
      `${proxyPrefix}/recording/${encodeURIComponent(camera)}` +
      `/start/${cleanTimestamp(start)}/end/${cleanTimestamp(end)}`
    );
  }

  _describeMediaError(videoEl) {
    const err = videoEl?.error;
    if (!err) return "unknown error";
    const codes = {
      1: "MEDIA_ERR_ABORTED (load aborted)",
      2: "MEDIA_ERR_NETWORK (network error)",
      3: "MEDIA_ERR_DECODE (decode failed)",
      4: "MEDIA_ERR_SRC_NOT_SUPPORTED (format/source unsupported)",
    };
    return `${codes[err.code] || `code ${err.code}`}${err.message ? ": " + err.message : ""}`;
  }

  _clipHttpStatus(error) {
    const status = Number(
      error?.status ??
      error?.response?.status ??
      error?.response?.code
    );
    if (Number.isFinite(status) && status > 0) return status;
    const match = String(error?.message || error || "").match(
      /(?:^|\D)(404|410)(?:\D|$)/
    );
    return match ? Number(match[1]) : null;
  }

  _classifyClipError(error) {
    const status = this._clipHttpStatus(error);
    if (status === 404 || status === 410) return "no_clip";
    if (error?.clipKind) return error.clipKind;
    const details = String(error?.details || "");
    const message = String(error?.message || error || "");
    if (/timeout|timeOut|Zeitüberschreitung/i.test(`${details} ${message}`)) {
      return "timeout";
    }
    if (/Parsing|decode|SRC_NOT_SUPPORTED|MEDIA_ERR_DECODE/i.test(`${details} ${message}`)) {
      return "decoder";
    }
    if (/LoadError|network|fetch|MEDIA_ERR_NETWORK/i.test(`${details} ${message}`)) {
      return "network";
    }
    return "unknown";
  }

  _clipFailureText(kind) {
    const lang = detectLang(this.hass, this._config?.language);
    const de = {
      timeout: "Der Clip lädt zu lange (Zeitüberschreitung).",
      network: "Der Clip konnte wegen eines Netzwerkfehlers nicht geladen werden.",
      decoder: "Der Browser konnte das Clipformat nicht decodieren.",
      unknown: "Der Clip konnte nicht geladen werden.",
    };
    const en = {
      timeout: "The clip took too long to load (timeout).",
      network: "The clip could not be loaded because of a network error.",
      decoder: "The browser could not decode the clip format.",
      unknown: "The clip could not be loaded.",
    };
    return (lang === "de" ? de : en)[kind] || (lang === "de" ? de.unknown : en.unknown);
  }

  _isMobileDevice() {
    if (typeof navigator === "undefined") return false;
    return (
      navigator.maxTouchPoints > 1 ||
      /iPhone|iPad|iPod|Android|Mobi/i.test(navigator.userAgent || "")
    );
  }

  _isIOS() {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    return /Mac/.test(ua) && navigator.maxTouchPoints > 1;
  }

  _isSafariDesktop() {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (!/Safari/i.test(ua)) return false;
    if (/Chrome|Chromium|Firefox|Edg/i.test(ua)) return false;
    return !this._isIOS();
  }

  _hlsNativeSupported() {
    const videoEl = document.createElement("video");
    return (
      !!videoEl.canPlayType &&
      videoEl.canPlayType("application/vnd.apple.mpegurl") !== ""
    );
  }

  _loadVideoSrcAwait(videoEl, url, timeoutMs, staleCheck) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        videoEl.removeEventListener("loadedmetadata", onLoaded);
        videoEl.removeEventListener("error", onError);
      };
      const onLoaded = () => {
        if (settled) return;
        if (staleCheck?.()) {
          settled = true;
          cleanup();
          const error = new Error("Veralteter Clip-Ladevorgang.");
          error.clipKind = "stale";
          reject(error);
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const mediaCode = videoEl?.error?.code;
        const error = new Error(this._describeMediaError(videoEl));
        error.clipKind =
          mediaCode === 2
            ? "network"
            : mediaCode === 3 || mediaCode === 4
              ? "decoder"
              : "unknown";
        reject(error);
      };
      videoEl.addEventListener("loadedmetadata", onLoaded);
      videoEl.addEventListener("error", onError);
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`Clip timeout after ${timeoutMs}ms`);
        error.clipKind = "timeout";
        reject(error);
      }, timeoutMs);
      videoEl.src = url;
      try { videoEl.load(); } catch {}
    });
  }

  async _loadHlsSrcAwait(
    videoEl,
    url,
    timeoutMs,
    staleCheck,
    lateFailure
  ) {
    if (!/\.m3u8(?:$|\?)/i.test(url) || this._hlsNativeSupported()) {
      return this._loadVideoSrcAwait(videoEl, url, timeoutMs, staleCheck);
    }
    const Hls = await loadHls();
    if (!Hls || !Hls.isSupported()) {
      const error = new Error("HLS wird von diesem Browser nicht unterstützt.");
      error.clipKind = "decoder";
      throw error;
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 30,
        maxBufferSize: 60 * 1000 * 1000,
        fragLoadPolicy: {
          default: {
            maxTimeToFirstByteMs: timeoutMs,
            maxLoadTimeMs: timeoutMs,
            timeoutRetry: { maxNumRetry: 0 },
            errorRetry: { maxNumRetry: 0 },
          },
        },
        manifestLoadPolicy: {
          default: {
            maxTimeToFirstByteMs: timeoutMs,
            maxLoadTimeMs: timeoutMs,
            timeoutRetry: { maxNumRetry: 0 },
            errorRetry: { maxNumRetry: 0 },
          },
        },
      });
      this._hls = hls;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        videoEl.removeEventListener("loadedmetadata", onLoaded);
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        try { hls.destroy(); } catch {}
        if (this._hls === hls) this._hls = null;
        reject(error);
      };
      const onLoaded = () => {
        if (settled) return;
        if (staleCheck?.()) {
          const error = new Error("Veralteter Clip-Ladevorgang.");
          error.clipKind = "stale";
          fail(error);
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };
      videoEl.addEventListener("loadedmetadata", onLoaded);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        const error = new Error(`HLS: ${data.details || data.type || "Fehler"}`);
        error.details = data.details || data.type || "";
        error.status = data?.response?.code ?? data?.response?.status;
        if (settled) {
          if (!staleCheck?.()) lateFailure?.(error);
          return;
        }
        fail(error);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!staleCheck?.()) this._tryAutoplay(videoEl);
      });
      timer = setTimeout(() => {
        const error = new Error(`HLS timeout after ${timeoutMs}ms`);
        error.clipKind = "timeout";
        fail(error);
      }, timeoutMs);
      hls.loadSource(url);
      hls.attachMedia(videoEl);
    });
  }

  _cleanupVideoEl(videoEl) {
    if (this._clipLateErrorCleanup) {
      this._clipLateErrorCleanup();
      this._clipLateErrorCleanup = null;
    }
    if (!videoEl) return;
    try { videoEl.pause(); } catch {}
    try { videoEl.srcObject = null; } catch {}
    videoEl.removeAttribute("src");
    try { videoEl.load(); } catch {}
  }

  _installLateClipErrorHandler(videoEl, token, attemptId, sourceUrl) {
    if (!videoEl) return;
    if (this._clipLateErrorCleanup) this._clipLateErrorCleanup();
    const onError = () => {
      cleanup();
      if (
        !this._isCurrentClipAttempt(token, attemptId) ||
        this._clipUrl !== sourceUrl
      ) {
        return;
      }
      const mediaCode = videoEl?.error?.code;
      const error = new Error(this._describeMediaError(videoEl));
      error.clipKind =
        mediaCode === 2
          ? "network"
          : mediaCode === 3 || mediaCode === 4
            ? "decoder"
            : "unknown";
      this._handleClipSourceFailure(error, token, attemptId);
    };
    const cleanup = () => {
      videoEl.removeEventListener("error", onError);
      if (this._clipLateErrorCleanup === cleanup) {
        this._clipLateErrorCleanup = null;
      }
    };
    videoEl.addEventListener("error", onError, { once: true });
    this._clipLateErrorCleanup = cleanup;
  }

  async _tryAutoplay(videoEl) {
    try {
      await videoEl.play();
    } catch (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) {
        console.info("[FrigateVisionCard] Autoplay with sound blocked – starting muted");
        videoEl.muted = true;
        try { await videoEl.play(); } catch {}
      }
    }
  }

  async _openClip(ev) {
    if (this._activeClip && this._activeClip.media_content_id === ev.media_content_id) {
      this._closeClip();
      return;
    }
    if (this._liveMode) this._closeLive();
    const token = ++this._clipLoadToken;
    this._activeClip = ev;
    this._clipUrl = null;
    this._clipError = null;
    this._clipLoading = true;
    this._clipSourceKind = null;
    this._clipResolvedHlsUrl = null;
    this._clipAttemptErrors = [];
    this._clipFailureHandledAttempt = null;
    this._clipAttemptId++;

    if (ev?._hasClip === false || ev?._frigate?.hasClip === false) {
      this._clipLoading = false;
      this._clipError = this._t.clip_no_recording;
      return;
    }

    try {
      const directUrl = this._directClipMp4Url(ev);
      if (!directUrl) throw new Error("Keine exakte Frigate-Event-ID verfügbar.");
      await this._beginClipSource("event_mp4", directUrl, token);
    } catch (e) {
      if (token !== this._clipLoadToken) return;
      this._clipAttemptErrors.push(this._classifyClipError(e));
      await this._startResolvedHlsFallback(token, e);
    }
  }

  _isCurrentClipAttempt(token, attemptId = this._clipAttemptId) {
    return (
      token === this._clipLoadToken &&
      attemptId === this._clipAttemptId &&
      !!this._activeClip
    );
  }

  async _beginClipSource(kind, sourceUrl, token) {
    if (token !== this._clipLoadToken || !this._activeClip) return false;
    if (!sourceUrl) throw new Error("Keine Medienquelle verfügbar.");
    const signedUrl = await this._signMediaPath(sourceUrl);
    if (token !== this._clipLoadToken || !this._activeClip) return false;
    this._clipAttemptId++;
    this._clipSourceKind = kind;
    this._clipUrl = signedUrl;
    this._clipLoading = true;
    this._clipError = null;
    console.info(
      `[FrigateVisionCard] Clip source ${kind} started for event`,
      this._activeClip?._eventId || "unknown"
    );
    return true;
  }

  async _startResolvedHlsFallback(token, previousError = null) {
    if (token !== this._clipLoadToken || !this._activeClip) return false;
    try {
      const result = await this.hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: this._activeClip.media_content_id,
      });
      if (token !== this._clipLoadToken || !this._activeClip) return false;
      if (!result?.url) throw new Error("Media Source lieferte keine Clip-URL.");
      this._clipResolvedHlsUrl = result.url;
      return await this._beginClipSource("resolved_hls", result.url, token);
    } catch (error) {
      if (token !== this._clipLoadToken) return false;
      const statusKind = this._classifyClipError(error);
      if (statusKind === "no_clip") {
        this._finishClipFailure("no_clip", token);
        return false;
      }
      if (previousError == null || error !== previousError) {
        this._clipAttemptErrors.push(statusKind);
      }
      return await this._startBoundedRecordingFallback(token);
    }
  }

  async _startBoundedRecordingFallback(token) {
    if (token !== this._clipLoadToken || !this._activeClip) return false;
    const recordingUrl =
      this._boundedRecordingMp4Url(this._clipResolvedHlsUrl) ||
      this._boundedRecordingMp4UrlFromEvent(this._activeClip);
    if (!recordingUrl) {
      this._finishClipFailure(
        this._preferredClipFailureKind(this._clipAttemptErrors),
        token
      );
      return false;
    }
    try {
      return await this._beginClipSource(
        "bounded_recording",
        recordingUrl,
        token
      );
    } catch (error) {
      if (token !== this._clipLoadToken) return false;
      const kind = this._classifyClipError(error);
      if (kind === "no_clip") {
        this._finishClipFailure("no_clip", token);
      } else {
        this._clipAttemptErrors.push(kind);
        this._finishClipFailure(
          this._preferredClipFailureKind(this._clipAttemptErrors),
          token
        );
      }
      return false;
    }
  }

  _preferredClipFailureKind(kinds) {
    const filtered = (kinds || []).filter(
      (kind) => kind && kind !== "stale" && kind !== "no_clip"
    );
    return filtered.at(-1) || "unknown";
  }

  _finishClipFailure(kind, token) {
    if (token !== this._clipLoadToken || !this._activeClip) return;
    this._clipLoading = false;
    this._clipError =
      kind === "no_clip"
        ? this._t.clip_no_recording
        : this._clipFailureText(kind);
    this.requestUpdate();
  }

  async _handleClipSourceFailure(error, token, attemptId) {
    if (!this._isCurrentClipAttempt(token, attemptId)) return;
    const kind = this._classifyClipError(error);
    if (kind === "stale") return;
    const failureKey = `${token}:${attemptId}`;
    if (this._clipFailureHandledAttempt === failureKey) return;
    this._clipFailureHandledAttempt = failureKey;
    if (kind === "no_clip") {
      this._finishClipFailure("no_clip", token);
      return;
    }
    this._clipAttemptErrors.push(kind);
    const failedSource = this._clipSourceKind;
    console.warn(
      `[FrigateVisionCard] Clip source ${failedSource} failed for event`,
      this._activeClip?._eventId || "unknown",
      kind
    );
    if (failedSource === "event_mp4") {
      await this._startResolvedHlsFallback(token, error);
      return;
    }
    if (failedSource === "resolved_hls") {
      await this._startBoundedRecordingFallback(token);
      return;
    }
    this._finishClipFailure(
      this._preferredClipFailureKind(this._clipAttemptErrors),
      token
    );
  }

  _handleTileClipLoaded(event) {
    const detail = event?.detail || {};
    if (!this._isCurrentClipAttempt(detail.token, detail.attemptId)) return;
    this._clipLoading = false;
    this._clipError = null;
  }

  _handleTileClipError(event) {
    const detail = event?.detail || {};
    if (!this._isCurrentClipAttempt(detail.token, detail.attemptId)) return;
    const error = new Error(detail.message || "Clip-Wiedergabefehler");
    error.clipKind = detail.kind || "unknown";
    error.status = detail.status;
    error.details = detail.details;
    this._handleClipSourceFailure(error, detail.token, detail.attemptId);
  }

  _disposeActiveClip() {
    this._clipLoadToken++;
    this._clipAttemptId++;
    this._cleanupVideoEl(this.renderRoot?.querySelector("video.player"));
    if (this._hls) {
      this._hls.destroy();
      this._hls = null;
    }
    this._activeClip = null;
    this._clipUrl = null;
    this._clipError = null;
    this._clipLoading = false;
    this._clipSourceKind = null;
    this._clipResolvedHlsUrl = null;
    this._clipAttemptErrors = [];
    this._clipFailureHandledAttempt = null;
  }

  _closeClip() {
    this._disposeActiveClip();
    // Always return to live after a user-driven clip close — also clear any
    // timeline selection so the VoD player doesn't take over instead.
    if (this._config?.view_mode === "timeline") {
      this._timelineSelected = false;
      this._cleanupTimeline();
      this._timelineHourStart = 0;
      this._timelinePendingSeekSec = null;
      this._timelinePlayerTime = 0;
    }
    if (!this._config?.multiview && !this._liveMode) {
      const liveCam = this._resolveLiveCamera();
      if (liveCam) this._openLive(liveCam);
    }
  }

  async _initPlayer() {
    const videoEl = this.renderRoot?.querySelector("video.player");
    if (!videoEl || !this._clipUrl) return;
    const token = this._clipLoadToken;
    const attemptId = this._clipAttemptId;
    const sourceKind = this._clipSourceKind;
    const sourceUrl = this._clipUrl;
    if (this._hls) {
      this._hls.destroy();
      this._hls = null;
    }
    this._cleanupVideoEl(videoEl);
    videoEl.muted = this._isMobileDevice();
    videoEl.volume = 1.0;
    const staleCheck = () =>
      !this._isCurrentClipAttempt(token, attemptId) ||
      this._clipUrl !== sourceUrl;
    const timeoutMs = sourceKind === "resolved_hls" ? 60000 : 40000;
    try {
      if (sourceKind === "resolved_hls") {
        await this._loadHlsSrcAwait(
          videoEl,
          sourceUrl,
          timeoutMs,
          staleCheck,
          (error) =>
            this._handleClipSourceFailure(error, token, attemptId)
        );
      } else {
        await this._loadVideoSrcAwait(
          videoEl,
          sourceUrl,
          timeoutMs,
          staleCheck
        );
      }
      if (staleCheck()) return;
      this._clipLoading = false;
      this._clipError = null;
      this._installLateClipErrorHandler(
        videoEl,
        token,
        attemptId,
        sourceUrl
      );
      this._tryAutoplay(videoEl);
    } catch (error) {
      if (staleCheck()) return;
      await this._handleClipSourceFailure(error, token, attemptId);
    }
  }

  /* ───────── Livestream (delegates to LivestreamController) ───────── */

  _ensureLivestreamController() {
    if (this._lc) return this._lc;
    this._lc = new LivestreamController({
      logPrefix: "[FrigateVisionCard Live]",
      failedMessage: this._t?.live_failed,
      getConfig: () => this._config,
      getHass: () => this.hass,
      getVideoEl: () => this.renderRoot?.querySelector("video.player"),
      getStreamName: (hd) => this._go2rtcStreamFor(this._liveCamera, hd),
      onUpdate: () => this.updateComplete,
      onState: (patch) => this._applyLiveState(patch),
    });
    return this._lc;
  }

  _applyLiveState(patch) {
    if ("loading" in patch) this._liveLoading = !!patch.loading;
    if ("provider" in patch) this._liveProvider = patch.provider ?? null;
    if ("talk" in patch) this._talkState = patch.talk;
    if ("talkMuted" in patch) this._talkMuted = patch.talkMuted;
    if ("talkAudioBlocked" in patch) this._talkAudioBlocked = patch.talkAudioBlocked;
    if ("error" in patch) this._liveError = patch.error ?? null;
    if ("mjpegUrl" in patch) this._mjpegSignedUrl = patch.mjpegUrl ?? null;
  }

  _isExternal() { return !isLocalNetwork(); }

  _resolveLiveCamera() {
    const configured = this._configuredCameraIds();
    const preferred = this._config?.live_camera;
    if (preferred && configured.includes(preferred)) return preferred;
    if (preferred && this._availableCameras?.includes(preferred)) return preferred;
    return configured[0] || this._availableCameras?.[0] || null;
  }

  _openLive(cameraId) {
    const cam = cameraId || this._resolveLiveCamera();
    if (!cam) {
      this._liveError = this._t.live_no_camera;
      return;
    }
    this._disposeActiveClip();
    this._focusCamera(cam);
    this._liveMode = true;
    this._liveCamera = cam;
    this._liveError = null;
    this._liveLoading = true;
    this._liveProvider = null;
    this._isHD = false;
    const lc = this._ensureLivestreamController();
    lc.cleanup();
    const pendingGeneration = lc.runGeneration;
    lc._isHD = false;
    this.updateComplete.then(() => lc.start(cam, pendingGeneration));
  }

  _closeLive() {
    this._lc?.cleanup();
    this._liveMode = false;
    this._liveCamera = null;
    this._liveError = null;
    this._liveLoading = false;
    this._liveProvider = null;
    this._mjpegSignedUrl = null;
    this._isHD = false;
  }

  _onMjpegError() {
    console.warn("[FrigateVisionCard] MJPEG <img> playback failed");
    this._liveError = `${this._t.live_failed} (MJPEG)`;
  }

  _toggleHD() {
    if (!this._liveCamera || !this._lc) return;
    this._lc.toggleHD();
    this._isHD = this._lc.isHD;
  }

  _switchLiveCamera(cameraName) {
    if (cameraName === this._liveCamera) return;
    this._focusCamera(cameraName);
    this._liveCamera = cameraName;
    this._isHD = false;
    this._liveLoading = true;
    this._liveError = null;
    this._liveProvider = null;
    this._ensureLivestreamController().switchCamera(cameraName);
  }

  /**
   * Focus the card on a single camera: syncs the camera filter so the events
   * list, the timeline marker stream and the timeline VoD playback all show
   * the same camera as the live picker selection.
   */
  _focusCamera(cameraName) {
    if (!cameraName) return;
    this._activeCameras = new Set([cameraName]);
    // If the timeline already has a different camera loaded, force a reload
    if (
      this._config?.view_mode === "timeline" &&
      this._timelineCamera &&
      this._timelineCamera !== cameraName
    ) {
      this._cleanupTimeline();
      this._timelineCamera = null;
      this._timelineHourStart = 0;
      this._timelinePendingSeekSec = null;
      this._timelinePlayerTime = 0;
    }
  }

  _cleanupLivestream() {
    this._lc?.cleanup();
  }

  /* ───────── Timeline (VoD recording with event markers) ───────── */

  _resolveTimelineCamera() {
    if (this._activeCameras && this._activeCameras.size > 0) {
      const first = Array.from(this._activeCameras)[0];
      if (first) return first;
    }
    return this._configuredCameraIds()[0] || this._availableCameras?.[0] || null;
  }

  _timelineWindowMs() {
    return (this._config?.timeline_window_hours || 24) * 3600 * 1000;
  }

  _computeTimelineRange() {
    if (this._timelineSelectedDay != null) {
      const start = this._timelineSelectedDay;
      const end = start + 24 * 3600 * 1000;
      this._timelineRangeStart = start;
      this._timelineRangeEnd = end;
      if (
        !this._timelineZoomCenter ||
        this._timelineZoomCenter < start ||
        this._timelineZoomCenter > end
      ) {
        // Anchor zoom near "now" if today is selected, else the day's noon
        const now = Date.now();
        this._timelineZoomCenter = now >= start && now <= end
          ? now
          : start + 12 * 3600 * 1000;
      }
      return { start, end };
    }
    const end = Date.now();
    const start = end - this._timelineWindowMs();
    this._timelineRangeStart = start;
    this._timelineRangeEnd = end;
    if (!this._timelineZoomCenter) this._timelineZoomCenter = end;
    return { start, end };
  }

  _setTimelineSelectedDay(dayStartMs) {
    if (this._timelineSelectedDay === dayStartMs) return;
    this._timelineSelectedDay = dayStartMs;
    // Reset zoom + reload VoD/markers for the new day
    this._timelineZoomLevel = 1;
    this._timelineZoomCenter = 0;
    this._cleanupTimeline();
    this._timelineHourStart = 0;
    this._timelinePendingSeekSec = null;
    this._timelinePlayerTime = 0;
    if (this._timelineSelected) {
      this.updateComplete.then(() => this._initTimeline());
    }
  }

  _timelineZoomLevels() {
    return [1, 2, 4, 8, 16, 24];
  }

  _timelineVisibleRange() {
    const totalSpan = this._timelineRangeEnd - this._timelineRangeStart;
    const visibleSpan = totalSpan / (this._timelineZoomLevel || 1);
    let center = this._timelineZoomCenter || this._timelineRangeEnd;
    let start = center - visibleSpan / 2;
    let end = center + visibleSpan / 2;
    if (end > this._timelineRangeEnd) {
      end = this._timelineRangeEnd;
      start = end - visibleSpan;
    }
    if (start < this._timelineRangeStart) {
      start = this._timelineRangeStart;
      end = Math.min(this._timelineRangeEnd, start + visibleSpan);
    }
    return { start, end };
  }

  _zoomTimelineStep(direction, anchorMs = null) {
    const levels = this._timelineZoomLevels();
    const idx = levels.indexOf(this._timelineZoomLevel || 1);
    const nextIdx = direction > 0
      ? Math.min(levels.length - 1, idx + 1)
      : Math.max(0, idx - 1);
    if (nextIdx === idx) return;
    if (anchorMs != null) this._timelineZoomCenter = anchorMs;
    this._timelineZoomLevel = levels[nextIdx];
  }

  _onTimelineWheel(e) {
    e.preventDefault();
    const target = e.currentTarget;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const isVertical = target.classList.contains("timeline-vertical");
    const ratio = isVertical
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    const visible = this._timelineVisibleRange();
    // Newest at top → ratio 0 = end, ratio 1 = start
    const anchorMs = isVertical
      ? visible.end - clamped * (visible.end - visible.start)
      : visible.start + clamped * (visible.end - visible.start);
    this._zoomTimelineStep(e.deltaY < 0 ? 1 : -1, anchorMs);
  }

  _onTimelinePointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    const target = e.currentTarget;
    if (!target) return;
    if (!this._timelinePinch) this._timelinePinch = new Map();
    this._timelinePinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { target.setPointerCapture(e.pointerId); } catch {}
    if (this._timelinePinch.size === 2) {
      // Switch to pinch-zoom; cancel any pan in progress
      this._timelineDragInfo = null;
      target.classList.remove("timeline-track--dragging");
      const pts = Array.from(this._timelinePinch.values());
      this._timelinePinchInfo = {
        target,
        rect: target.getBoundingClientRect(),
        isVertical: target.classList.contains("timeline-vertical"),
        startDistance: this._distance(pts[0], pts[1]),
        startZoom: this._timelineZoomLevel,
        startCenter: this._timelineZoomCenter || this._timelineRangeEnd,
      };
      return;
    }
    if (this._timelinePinch.size > 1) return; // ignore further fingers
    const visible = this._timelineVisibleRange();
    this._timelineDragInfo = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      isVertical: target.classList.contains("timeline-vertical"),
      rect: target.getBoundingClientRect(),
      initialCenter: this._timelineZoomCenter || this._timelineRangeEnd,
      visibleSpan: visible.end - visible.start,
      moved: false,
      target,
    };
  }

  _distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _onTimelinePointerMove(e) {
    if (this._timelinePinch && this._timelinePinch.has(e.pointerId)) {
      this._timelinePinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (this._timelinePinchInfo && this._timelinePinch?.size >= 2) {
      const pts = Array.from(this._timelinePinch.values()).slice(0, 2);
      const dist = this._distance(pts[0], pts[1]);
      const ratio = dist / this._timelinePinchInfo.startDistance;
      const levels = this._timelineZoomLevels();
      const startIdx = levels.indexOf(this._timelinePinchInfo.startZoom);
      // Pinch out (ratio>1) → zoom in (more steps); pinch in → zoom out
      const stepDelta = Math.round(Math.log2(Math.max(0.1, ratio)) * 1.5);
      const targetIdx = Math.max(0, Math.min(levels.length - 1, startIdx + stepDelta));
      const targetZoom = levels[targetIdx];
      if (targetZoom !== this._timelineZoomLevel) {
        this._timelineZoomLevel = targetZoom;
      }
      // Anchor zoom around midpoint between fingers
      const info = this._timelinePinchInfo;
      const mid = info.isVertical
        ? (pts[0].y + pts[1].y) / 2
        : (pts[0].x + pts[1].x) / 2;
      const trackSize = info.isVertical ? info.rect.height : info.rect.width;
      const trackOrigin = info.isVertical ? info.rect.top : info.rect.left;
      if (trackSize) {
        const ratioInTrack = Math.max(0, Math.min(1, (mid - trackOrigin) / trackSize));
        const visible = this._timelineVisibleRange();
        // Newest at top → ratio 0 = end, ratio 1 = start
        const anchorMs = info.isVertical
          ? visible.end - ratioInTrack * (visible.end - visible.start)
          : visible.start + ratioInTrack * (visible.end - visible.start);
        // Pull center towards finger midpoint
        const halfSpan = (this._timelineRangeEnd - this._timelineRangeStart) / (this._timelineZoomLevel || 1) / 2;
        const minC = this._timelineRangeStart + halfSpan;
        const maxC = this._timelineRangeEnd - halfSpan;
        if (minC <= maxC) {
          this._timelineZoomCenter = Math.max(minC, Math.min(maxC, anchorMs));
        }
      }
      return;
    }
    const info = this._timelineDragInfo;
    if (!info || e.pointerId !== info.pointerId) return;
    const deltaPx = info.isVertical
      ? e.clientY - info.startY
      : e.clientX - info.startX;
    if (!info.moved && Math.abs(deltaPx) > 5) {
      info.moved = true;
      info.target.classList.add("timeline-track--dragging");
      // Switch back to VoD on drag start if a clip was playing
      if (this._activeClip) this._disposeActiveClip();
    }
    if (!info.moved) return;
    const trackSize = info.isVertical ? info.rect.height : info.rect.width;
    if (!trackSize) return;
    const deltaMs = (deltaPx / trackSize) * info.visibleSpan;
    const halfSpan = info.visibleSpan / 2;
    const minCenter = this._timelineRangeStart + halfSpan;
    const maxCenter = this._timelineRangeEnd - halfSpan;
    // Vertical axis renders newest at top: drag down should reveal newer
    // content (move centre toward `end`), so we add deltaMs there.
    let newCenter = info.isVertical
      ? info.initialCenter + deltaMs
      : info.initialCenter - deltaMs;
    if (minCenter <= maxCenter) {
      newCenter = Math.max(minCenter, Math.min(maxCenter, newCenter));
    }
    this._timelineZoomCenter = newCenter;
  }

  _onTimelinePointerUp(e) {
    if (this._timelinePinch?.has(e.pointerId)) {
      this._timelinePinch.delete(e.pointerId);
      try { e.currentTarget?.releasePointerCapture(e.pointerId); } catch {}
      if (this._timelinePinch.size < 2) this._timelinePinchInfo = null;
      // If we just exited pinch and a finger remains, swallow this up so it
      // doesn't immediately register as a tap-seek.
      if (this._timelinePinch.size > 0) return;
    }
    const info = this._timelineDragInfo;
    if (!info || e.pointerId !== info.pointerId) return;
    try { info.target.releasePointerCapture(e.pointerId); } catch {}
    info.target.classList.remove("timeline-track--dragging");
    this._timelineDragInfo = null;
    if (!info.moved) {
      this._seekTimelineFromClick(e);
    }
  }

  _onTimelinePointerCancel(e) {
    if (this._timelinePinch?.has(e.pointerId)) {
      this._timelinePinch.delete(e.pointerId);
      try { e.currentTarget?.releasePointerCapture(e.pointerId); } catch {}
      if (this._timelinePinch.size < 2) this._timelinePinchInfo = null;
    }
    const info = this._timelineDragInfo;
    if (!info || e.pointerId !== info.pointerId) return;
    try { info.target.releasePointerCapture(e.pointerId); } catch {}
    info.target.classList.remove("timeline-track--dragging");
    this._timelineDragInfo = null;
  }

  _hourStartMs(timestampMs) {
    return timestampMs - (timestampMs % 3600000);
  }

  _timelineHourVodUrl(camera, hourStartMs) {
    if (!camera) return null;
    // Frigate 0.17 hour-based VoD: /vod/<YYYY-MM>/<DD>/<HH>/<camera>/index.m3u8
    // Empirically: the endpoint interprets the path components as LOCAL time
    // (matches Frigate's storage layout for the user's tz, despite the docs
    // suggesting UTC). Use local date parts.
    const d = new Date(hourStartMs);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyymm = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const clientId = this._config?.frigate_client_id;
    const base = clientId ? `/api/frigate/${clientId}` : `/api/frigate`;
    return `${base}/vod/${yyyymm}/${dd}/${hh}/${camera}/index.m3u8`;
  }

  _timelineEvents() {
    if (!this._events) return [];
    const cam = this._timelineCamera;
    if (!cam) return [];
    const start = this._timelineRangeStart;
    const end = this._timelineRangeEnd;
    let list = this._events.filter((ev) => {
      if (ev._camera !== cam) return false;
      if (!ev._ts) return false;
      const t = ev._ts.getTime();
      return t >= start && t <= end;
    });
    if (this._activeLabels && this._activeLabels.size > 0) {
      list = list.filter((ev) => {
        const lbl = (ev._label || "").toLowerCase();
        return lbl && this._activeLabels.has(lbl);
      });
    }
    return list;
  }

  async _initTimeline() {
    if (this._config?.view_mode !== "timeline") return;
    this._disposeActiveClip();
    const cam = this._resolveTimelineCamera();
    if (!cam) {
      this._timelineError = this._t.timeline_no_camera;
      this._timelineCamera = null;
      return;
    }
    const camChanged = this._timelineCamera !== cam;
    this._timelineCamera = cam;
    this._computeTimelineRange();

    // Wenn keine Position/Stunde ausgewählt: Live-Ansicht (wie Events-Ansicht).
    if (!this._timelineSelected) {
      if (this._timelineHls) this._cleanupTimeline();
      return;
    }

    // Position ausgewählt → HLS-Player für die Zielstunde laden.
    if (!camChanged && this._timelineHls) return;
    this._cleanupTimeline();
    const hour = this._timelineHourStart || this._hourStartMs(Date.now());
    const seekMs = this._timelinePendingSeekSec != null
      ? hour + this._timelinePendingSeekSec * 1000
      : null;
    await this._loadTimelineHour(hour, seekMs);
  }

  _setTimelineSelected(selected) {
    const next = !!selected;
    if (this._timelineSelected === next) return;
    this._timelineSelected = next;
    if (next) {
      // User hat eine Position gewählt → Live verlassen
      if (this._liveMode) this._closeLive();
    } else {
      // Zurück zur Live-Ansicht
      this._cleanupTimeline();
      this._timelineHourStart = 0;
      this._timelinePendingSeekSec = null;
      this._timelinePlayerTime = 0;
      if (this._config?.live_autostart && !this._liveMode) {
        const liveCam = this._resolveLiveCamera();
        if (liveCam) this._openLive(liveCam);
      }
    }
  }

  async _loadTimelineHour(hourStartMs, seekTimestampMs) {
    const cam = this._timelineCamera;
    if (!cam) return;
    if (this._timelineHourStart === hourStartMs && this._timelineHls) {
      // Already on this hour — just seek
      if (seekTimestampMs != null) this._seekWithinCurrentHour(seekTimestampMs);
      return;
    }
    this._cleanupTimeline();
    this._timelineHourStart = hourStartMs;
    this._timelinePendingSeekSec = seekTimestampMs != null
      ? Math.max(0, (seekTimestampMs - hourStartMs) / 1000)
      : null;
    this._timelineLoading = true;
    this._timelineError = null;
    this._timelinePlayerTime = 0;
    await this.updateComplete;
    await this._initTimelinePlayer();
  }

  async _signPath(path) {
    try {
      const parsed = new URL(path, location.origin);
      if (parsed.searchParams.has("authSig")) return parsed.toString();
      const result = await this.hass.callWS({
        type: "auth/sign_path",
        path: `${parsed.pathname}${parsed.search}`,
        expires: 3600,
      });
      // Convert to absolute URL so blob:-based manifests resolve correctly
      return new URL(result?.path || path, location.origin).toString();
    } catch (e) {
      console.warn(
        "[FrigateVisionCard] sign_path failed for timeline media:",
        e?.message || e
      );
      return new URL(path, location.origin).toString();
    }
  }

  async _fetchSignedManifest(manifestPath) {
    const signedManifestPath = await this._signPath(manifestPath);
    const resp = await fetch(signedManifestPath);
    if (!resp.ok) {
      const err = new Error(`Manifest fetch failed: ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    const text = await resp.text();
    const basePath = manifestPath.substring(0, manifestPath.lastIndexOf("/"));
    const lines = text.split("\n");
    const tasks = lines.map((line) => {
      const trimmed = line.trim();
      const mapMatch = trimmed.match(/^#EXT-X-MAP:URI="([^"]+)"/);
      if (mapMatch) {
        const sub = `${basePath}/${mapMatch[1]}`;
        return this._signPath(sub).then((signed) => line.replace(mapMatch[1], signed));
      }
      if (trimmed && !trimmed.startsWith("#")) {
        const sub = `${basePath}/${trimmed}`;
        return this._signPath(sub);
      }
      return Promise.resolve(line);
    });
    const rewritten = await Promise.all(tasks);
    const blob = new Blob([rewritten.join("\n")], {
      type: "application/vnd.apple.mpegurl",
    });
    if (this._timelineBlobUrl) {
      try { URL.revokeObjectURL(this._timelineBlobUrl); } catch {}
    }
    this._timelineBlobUrl = URL.createObjectURL(blob);
    return this._timelineBlobUrl;
  }

  async _initTimelinePlayer() {
    const videoEl = this.renderRoot?.querySelector("video.timeline-player");
    if (!videoEl) return;
    const cam = this._timelineCamera;
    if (!cam) return;
    const manifestPath = this._timelineHourVodUrl(cam, this._timelineHourStart);
    if (!manifestPath) {
      this._timelineError = this._t.timeline_failed;
      this._timelineLoading = false;
      return;
    }


    videoEl.removeEventListener("timeupdate", this._onTimelineTick);
    this._onTimelineTick = () => {
      this._timelinePlayerTime = videoEl.currentTime || 0;
    };
    videoEl.addEventListener("timeupdate", this._onTimelineTick);

    // Diagnostic listeners (logged once per load to avoid spam)
    if (this._timelineDiagListeners) {
      this._timelineDiagListeners.forEach(({ evt, fn }) =>
        videoEl.removeEventListener(evt, fn)
      );
    }
    const diag = (evt) => () =>
      console.info(`[FrigateVisionCard] video.${evt}`, "currentTime=", videoEl.currentTime, "paused=", videoEl.paused);
    this._timelineDiagListeners = ["seeked", "waiting", "stalled", "playing", "pause"].map((evt) => ({
      evt,
      fn: diag(evt),
    }));
    this._timelineDiagListeners.forEach(({ evt, fn }) => videoEl.addEventListener(evt, fn));

    let seekAttempted = false;
    const seekEvents = ["loadedmetadata", "loadeddata", "durationchange", "canplay"];
    const attemptInitialSeek = () => {
      if (seekAttempted) return;
      const dur = videoEl.duration;
      if (!dur || !isFinite(dur)) return;
      seekAttempted = true;
      this._timelineLoading = false;
      console.info("[FrigateVisionCard] Timeline loaded, duration:", dur, "pendingSeekSec:", this._timelinePendingSeekSec);
      if (dur > 3700) {
        console.warn("[FrigateVisionCard] Manifest duration > 1h:", dur, "— Frigate may have stitched extra recordings");
      }
      try {
        if (this._timelinePendingSeekSec != null) {
          const target = Math.max(0, Math.min(dur - 0.5, this._timelinePendingSeekSec));
          videoEl.currentTime = target;
          this._timelinePendingSeekSec = null;
          videoEl.play().catch(() => {});
        } else {
          videoEl.currentTime = Math.max(0, dur - 1);
        }
      } catch (e) {
        console.warn("[FrigateVisionCard] Initial seek failed:", e);
      }
      // Detach to avoid leaks — successful seek done
      seekEvents.forEach((evt) => videoEl.removeEventListener(evt, attemptInitialSeek));
      this._timelineSeekHandler = null;
    };
    // Detach any handler from a previous load
    if (this._timelineSeekHandler && this._timelineSeekEvents) {
      this._timelineSeekEvents.forEach((evt) => videoEl.removeEventListener(evt, this._timelineSeekHandler));
    }
    this._timelineSeekHandler = attemptInitialSeek;
    this._timelineSeekEvents = seekEvents;
    seekEvents.forEach((evt) => videoEl.addEventListener(evt, attemptInitialSeek));

    let blobUrl;
    try {
      blobUrl = await this._fetchSignedManifest(manifestPath);
    } catch (e) {
      console.warn("[FrigateVisionCard] Timeline manifest fetch failed:", e);
      this._timelineError = e.status === 404
        ? this._t.timeline_no_recording
        : `${this._t.timeline_failed}: ${e.message}`;
      this._timelineLoading = false;
      return;
    }

    try {
      const Hls = await loadHls();
      if (Hls && Hls.isSupported()) {
        this._timelineHls = new Hls({
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          fragLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 8000,
              maxLoadTimeMs: 15000,
              timeoutRetry: { maxNumRetry: 1, retryDelayMs: 500 },
              errorRetry: { maxNumRetry: 0 },
            },
          },
          manifestLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 8000,
              maxLoadTimeMs: 10000,
              timeoutRetry: { maxNumRetry: 0 },
              errorRetry: { maxNumRetry: 0 },
            },
          },
        });
        this._timelineHls.loadSource(blobUrl);
        this._timelineHls.attachMedia(videoEl);
        this._timelineHls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data?.fatal) return;
          console.warn(
            "[FrigateVisionCard] Timeline HLS error:",
            data.details,
            data?.response?.code ?? data?.response?.status ?? ""
          );
          this._timelineHls?.destroy();
          this._timelineHls = null;
          this._timelineError = `${this._t.timeline_failed}: ${data.details}`;
          this._timelineLoading = false;
        });
        return;
      }
    } catch (e) {
      console.warn("[FrigateVisionCard] Timeline HLS load failed:", e);
    }
    // Native fallback (Safari/iOS): blob URL plays natively too
    videoEl.src = blobUrl;
    videoEl.addEventListener(
      "error",
      () => {
        this._timelineError = `${this._t.timeline_failed}: ${this._describeMediaError(videoEl)}`;
        this._timelineLoading = false;
      },
      { once: true }
    );
  }

  _seekWithinCurrentHour(timestampMs) {
    const videoEl = this.renderRoot?.querySelector("video.timeline-player");
    if (!videoEl) return;
    const offsetSec = Math.max(0, (timestampMs - this._timelineHourStart) / 1000);
    const dur = videoEl.duration && isFinite(videoEl.duration) ? videoEl.duration : 3600;
    const target = Math.max(0, Math.min(dur - 0.5, offsetSec));
    console.info(
      "[FrigateVisionCard] Seek within hour:",
      "ts=", new Date(timestampMs).toISOString(),
      "hourStart=", new Date(this._timelineHourStart).toISOString(),
      "offsetSec=", offsetSec,
      "duration=", dur,
      "→ currentTime=", target
    );
    try {
      videoEl.currentTime = target;
      videoEl.play().catch(() => {});
    } catch (e) {
      console.warn("[FrigateVisionCard] Seek failed:", e);
    }
  }

  _seekTimelineTo(timestampMs) {
    // Auto-pan zoom window if the target is currently outside the visible range
    const visible = this._timelineVisibleRange();
    if (timestampMs < visible.start || timestampMs > visible.end) {
      this._timelineZoomCenter = timestampMs;
    }
    const targetHour = this._hourStartMs(timestampMs);
    if (targetHour !== this._timelineHourStart) {
      this._loadTimelineHour(targetHour, timestampMs);
      return;
    }
    this._seekWithinCurrentHour(timestampMs);
  }

  _seekTimelineFromClick(e) {
    const target = e.currentTarget;
    if (!target) return;
    // Switch back to VoD if a single clip was active
    if (this._activeClip) this._disposeActiveClip();
    // Auswahl gesetzt → wechselt von Live zur Timeline-Ansicht
    this._setTimelineSelected(true);
    const rect = target.getBoundingClientRect();
    const isVertical = target.classList.contains("timeline-vertical");
    const ratio = isVertical
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    const visible = this._timelineVisibleRange();
    // Newest at top → ratio 0 = end, ratio 1 = start
    const ts = isVertical
      ? visible.end - clamped * (visible.end - visible.start)
      : visible.start + clamped * (visible.end - visible.start);
    this._seekTimelineTo(ts);
  }

  _onTimelineMarkerClick(ev) {
    // Stunde + Offset für VoD nach dem Schließen des Clips merken
    if (ev?._ts) {
      const ts = ev._ts.getTime();
      this._timelineHourStart = this._hourStartMs(ts);
      this._timelinePendingSeekSec = (ts - this._timelineHourStart) / 1000;
    }
    this._setTimelineSelected(true);
    this._openClip(ev);
  }

  _closeTimelineSelection() {
    this._setTimelineSelected(false);
  }

  _cleanupTimeline() {
    if (this._timelineHls) {
      try { this._timelineHls.destroy(); } catch {}
      this._timelineHls = null;
    }
    if (this._timelineBlobUrl) {
      try { URL.revokeObjectURL(this._timelineBlobUrl); } catch {}
      this._timelineBlobUrl = null;
    }
    const videoEl = this.renderRoot?.querySelector("video.timeline-player");
    if (videoEl) {
      if (this._onTimelineTick) {
        videoEl.removeEventListener("timeupdate", this._onTimelineTick);
      }
      if (this._timelineSeekHandler && this._timelineSeekEvents) {
        this._timelineSeekEvents.forEach((evt) =>
          videoEl.removeEventListener(evt, this._timelineSeekHandler)
        );
      }
      try { videoEl.pause(); } catch {}
      videoEl.removeAttribute("src");
      try { videoEl.load(); } catch {}
    }
    if (this._timelineDiagListeners && videoEl) {
      this._timelineDiagListeners.forEach(({ evt, fn }) =>
        videoEl.removeEventListener(evt, fn)
      );
    }
    this._timelineDiagListeners = null;
    this._onTimelineTick = null;
    this._timelineSeekHandler = null;
    this._timelineSeekEvents = null;
    this._timelinePlayerTime = 0;
  }

  _getTargetCameras() {
    const keys = Object.keys(this._config?.cameras || {});
    return keys.length ? keys : "all";
  }

  _loadMore() {
    this._totalCap = (this._totalCap || this._config.initial_events) +
      this._config.events_per_load;
    this._fetchAll();
  }

  _loadLess() {
    const min = this._config.initial_events || 10;
    const step = this._config.events_per_load || 10;
    this._totalCap = Math.max(min, (this._totalCap || min) - step);
    this._fetchAll();
  }

  _availableLabels() {
    const set = new Set();
    for (const ev of this._events || []) {
      const lbl = (ev._label || "").toLowerCase();
      if (lbl) set.add(lbl);
    }
    return Array.from(set).sort();
  }

  _filteredEvents() {
    if (!this._events) return [];
    let list = this._events;

    if (this._activeCameras && this._activeCameras.size > 0) {
      list = list.filter((ev) => this._activeCameras.has(ev._camera));
    }

    if (this._activeLabels && this._activeLabels.size > 0) {
      list = list.filter((ev) => {
        const lbl = (ev._label || "").toLowerCase();
        return lbl && this._activeLabels.has(lbl);
      });
    }

    if (this._dateFilter && this._dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      list = list.filter((ev) => {
        if (!ev._ts) return false;
        const d = new Date(
          ev._ts.getFullYear(),
          ev._ts.getMonth(),
          ev._ts.getDate()
        );
        const diffDays = Math.round((today - d) / 86400000);
        if (this._dateFilter === "today") return diffDays === 0;
        if (this._dateFilter === "yesterday") return diffDays === 1;
        if (this._dateFilter === "week") return diffDays >= 0 && diffDays <= 7;
        return true;
      });
    }
    return list;
  }

  _toggleLabel(label) {
    const next = new Set(this._activeLabels || []);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    this._activeLabels = next.size === 0 ? null : next;
  }

  _toggleCamera(cam) {
    const next = new Set(this._activeCameras || []);
    if (next.has(cam)) next.delete(cam);
    else next.add(cam);
    this._activeCameras = next.size === 0 ? null : next;
  }

  _setDateFilter(val) {
    this._dateFilter = val;
    this._showDateMenu = false;
  }

  _toggleLabelMenu() {
    this._showLabelMenu = !this._showLabelMenu;
    if (this._showLabelMenu) {
      this._showDateMenu = false;
      this._showCameraMenu = false;
      this._showLiveCamMenu = false;
    }
  }

  _toggleDateMenu() {
    this._showDateMenu = !this._showDateMenu;
    if (this._showDateMenu) {
      this._showLabelMenu = false;
      this._showCameraMenu = false;
      this._showLiveCamMenu = false;
    }
  }

  _toggleCameraMenu() {
    this._showCameraMenu = !this._showCameraMenu;
    if (this._showCameraMenu) {
      this._showLabelMenu = false;
      this._showDateMenu = false;
      this._showLiveCamMenu = false;
    }
  }

  _refresh() {
    this._totalCap = this._config.initial_events;
    this._fetchAll();
    // Restart single live stream
    if (this._liveMode && this._liveCamera) {
      this._liveLoading = true;
      this._liveProvider = null;
      this._liveError = null;
      this._ensureLivestreamController().restart();
    }
    // Restart timeline (recompute range to "now")
    if (this._config.view_mode === "timeline" && this._timelineCamera) {
      this._cleanupTimeline();
      this.updateComplete.then(() => this._initTimeline());
    }
    // Restart all multiview tiles
    if (this._config.multiview) {
      this.updateComplete.then(() => {
        const tiles = this.renderRoot?.querySelectorAll("frigate-vision-live-tile");
        if (tiles) tiles.forEach((tile) => tile._restart());
      });
    }
  }

  _openLightbox(ev, snapUrl) {
    this._lightbox = { ev, url: snapUrl };
    this.updateComplete.then(() => {
      const dlg = this.shadowRoot?.querySelector("dialog.lightbox");
      if (dlg && !dlg.open) {
        try {
          dlg.showModal();
        } catch (e) {
          /* already open */
        }
      }
    });
  }

  _closeLightbox() {
    const dlg = this.shadowRoot?.querySelector("dialog.lightbox");
    if (dlg?.open) {
      try {
        dlg.close();
      } catch (e) {
        /* ignore */
      }
    }
    this._lightbox = null;
  }

  render() {
    if (!this._config) return html``;
    if (this._config.view_mode === "doorbell") return this._renderDoorbellView();
    const t = this._t;
    const displayTitle =
      !this._config.title || this._config.title === "auto"
        ? t.title
        : this._config.title;

    const filtered = this._filteredEvents();

    let mergedCardStyle = "";
    if (this._config.section_mode) {
      mergedCardStyle = "height: 100%; width: 100%;";
    } else {
      const bp = this._config.desktop_breakpoint || 800;
      const isDesktop = this._cardWidth >= bp;
      const h =
        (isDesktop ? this._config.desktop_height : this._config.mobile_height)
        ?? this._config.height;
      const heightCss = this._cssSize(h);
      if (heightCss) {
        mergedCardStyle += `height: ${heightCss};`;
        if (this._isPercentSize(heightCss)) {
          mergedCardStyle += "min-height: 0;";
        }
      }
      const widthCss = this._cssSize(this._config.width);
      if (widthCss) {
        if (this._isPercentSize(widthCss)) {
          mergedCardStyle += `width: ${widthCss}; max-width: ${widthCss};`;
          mergedCardStyle += widthCss === "100%" ? "margin: 0;" : "margin: 0 auto;";
        } else {
          mergedCardStyle += `max-width: ${widthCss}; width: 100%; margin: 0 auto;`;
        }
      }
    }

    const isSplit = this._isSplitLayout();
    const splitClass = `split ${isSplit ? "is-split" : "is-stacked"}`;
    const showHeader = this._config.show_title;
    const showRightFilters =
      this._config.show_filters && (!isSplit || !this._config.show_title);

    return html`
      <ha-card style=${mergedCardStyle}>
        ${showHeader
          ? html`
              <div class="header">
                <div class="title">
                  ${this._config.title_icon ? html`<ha-icon icon="${this._config.title_icon}" style="margin-right:6px;--mdc-icon-size:20px;"></ha-icon>` : ""}
                  ${displayTitle}
                </div>
                ${isSplit && this._config.show_filters
                  ? this._renderFilters()
                  : html`<div class="spacer"></div>`}
                ${!this._config.show_filters
                  ? this._renderRefreshButton()
                  : ""}
              </div>
            `
          : ""}

        <div class="${splitClass}">
          <div class="left">${this._renderLeftPanel()}</div>
          <div class="right">
            ${showRightFilters
              ? this._renderFilters()
              : ""}
            ${this._error ? html`<div class="error">${this._error}</div>` : ""}
            ${this._config.view_mode === "timeline"
              ? this._renderTimeline(isSplit)
              : html`<div class="list-wrap">
                  <div class="list">${this._renderEventList(filtered)}</div>
                </div>`}
          </div>
        </div>

        ${this._renderLightbox()}
      </ha-card>
    `;
  }

  _renderLeftPanel() {
    if (this._config.view_mode === "timeline") {
      // Clip aktiv → Clip-Player (wie bisher)
      if (this._activeClip) return this._renderPlayer();
      // Keine Stunde/Position ausgewählt → Live-Ansicht (wie Events-Ansicht)
      if (!this._timelineSelected) return this._renderPlayer();
      // Auswahl aktiv → VoD-Player
      return this._renderTimelinePlayer();
    }
    if (this._config.multiview) return this._renderMultiview();
    return this._renderPlayer();
  }

  _renderTimelinePlayer() {
    const t = this._t;
    const cam = this._timelineCamera || this._resolveTimelineCamera();
    if (!cam) {
      return html`
        <div class="player-placeholder">
          <ha-icon icon="mdi:filmstrip-off"></ha-icon>
          <div>${t.timeline_no_camera}</div>
        </div>
      `;
    }
    return html`
      <div class="player-wrap timeline-player-wrap">
        ${this._timelineLoading ? html`<div class="loading">${t.timeline_loading}</div>` : ""}
        ${this._timelineError ? html`<div class="error">${this._timelineError}</div>` : ""}
        <video class="timeline-player" playsinline controls preload="metadata"></video>
        <div class="player-top-buttons">
          <button class="overlay-btn" @click=${() => this._closeTimelineSelection()} title="${t.close}">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  _renderTimeline(_isSplit) {
    const t = this._t;
    const cam = this._timelineCamera;
    const events = this._timelineEvents();
    const lang = detectLang(this.hass, this._config?.language);
    // Timeline orientation is always vertical — horizontal axis was too cramped.
    // The card layout (split/stacked) still controls where the timeline lives.
    const isSplit = true;
    const orientation = "vertical";
    const visible = this._timelineVisibleRange();
    const start = visible.start;
    const end = visible.end;
    const span = end - start;
    const ticks = this._buildTimelineTicks(start, end, isSplit);

    const visibleEvents = events.filter((ev) => {
      if (!ev._ts) return false;
      const ts = ev._ts.getTime();
      return ts >= start && ts <= end;
    });

    let indicatorPos = null;
    if (this._timelineHourStart) {
      const cappedSec = Math.min(this._timelinePlayerTime || 0, 3600);
      const absTimeMs = this._timelineHourStart + cappedSec * 1000;
      if (absTimeMs >= start && absTimeMs <= end) {
        // Newest at top → invert position
        indicatorPos = (1 - (absTimeMs - start) / span) * 100;
      }
    }

    const flipped = this._config?.timeline_flipped === true;
    return html`
      <div class="timeline-wrap timeline-${orientation} ${flipped ? "timeline-flipped" : ""}">
        <div class="timeline-body timeline-${orientation} ${flipped ? "timeline-flipped" : ""}">
          <div
            class="timeline-track timeline-${orientation}"
            @pointerdown=${(e) => this._onTimelinePointerDown(e)}
            @pointermove=${(e) => this._onTimelinePointerMove(e)}
            @pointerup=${(e) => this._onTimelinePointerUp(e)}
            @pointercancel=${(e) => this._onTimelinePointerCancel(e)}
            @wheel=${(e) => this._onTimelineWheel(e)}
          >
            <div class="timeline-axis-line"></div>
            <div class="timeline-axis">
              ${ticks.map((tk) => html`
                <div
                  class="timeline-tick"
                  style=${isSplit
                    ? `top: ${tk.pos}%;`
                    : `left: ${tk.pos}%;`}
                >
                  <span class="timeline-tick-label">${tk.label}</span>
                </div>
              `)}
            </div>
            <div class="timeline-event-marks">
              ${visibleEvents.map((ev) => {
                const ts = ev._ts.getTime();
                // Newest at top → invert position
                const pos = (1 - (ts - start) / span) * 100;
                const rawLabel = ev._label || "";
                const color = labelColor(rawLabel, this._config?.label_colors);
                const styleParts = [
                  isSplit ? `top: ${pos}%` : `left: ${pos}%`,
                ];
                if (color) styleParts.push(`--bar-color: ${color}`);
                return html`<div class="timeline-event-mark" style=${styleParts.join("; ")}></div>`;
              })}
            </div>
            ${indicatorPos != null
              ? html`<div
                  class="timeline-indicator"
                  style=${isSplit ? `top: ${indicatorPos}%;` : `left: ${indicatorPos}%;`}
                >
                  ${this._timelineHourStart
                    ? html`<span class="timeline-indicator-time">${this._formatWallClock()}</span>`
                    : ""}
                </div>`
              : ""}
          </div>
          <div class="timeline-event-list">
            ${visibleEvents.length === 0
              ? html`<div class="timeline-empty">${t.no_events}</div>`
              : visibleEvents.map((ev) => this._renderTimelineMarkerCard(ev, lang))}
          </div>
        </div>
        ${events.length === 0 && !this._timelineError
          ? html`<div class="timeline-empty">${t.no_events}</div>`
          : ""}
      </div>
    `;
  }

  _buildTimelineTicks(start, end, isSplit) {
    const span = end - start;
    const hours = span / 3600000;
    let stepHours;
    if (hours <= 1.5) stepHours = 0.25;
    else if (hours <= 3) stepHours = 0.5;
    else if (hours <= 6) stepHours = 1;
    else if (hours <= 24) stepHours = 3;
    else if (hours <= 72) stepHours = 6;
    else stepHours = 24;

    const stepMs = stepHours * 3600000;
    const ticks = [];
    const startTick = Math.ceil(start / stepMs) * stepMs;
    for (let t = startTick; t <= end; t += stepMs) {
      // Newest at top → invert position
      const pos = (1 - (t - start) / span) * 100;
      const d = new Date(t);
      const pad = (n) => String(n).padStart(2, "0");
      const label = stepHours >= 24
        ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`
        : stepHours >= 1
          ? `${pad(d.getHours())}:00`
          : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      ticks.push({ pos, label });
    }
    return ticks;
  }

  _formatWallClock() {
    if (!this._timelineHourStart) return "";
    const absMs = this._timelineHourStart + (this._timelinePlayerTime || 0) * 1000;
    const d = new Date(absMs);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(Math.floor(d.getSeconds()))}`;
  }

  _renderTimelineMarkerCard(ev, lang) {
    const t = this._t;
    const titleText = this._eventTitle(ev, lang, t);
    const description = this._eventShortDesc(ev);
    const camera = ev._camera;
    const rawLabel = ev._label || "";
    const labelText = translateLabel(rawLabel, lang);
    const chip = this._renderLabelChip(rawLabel, labelText);
    const timeStr = formatTime(ev._ts, t);
    const snapUrl = this._snapshotUrl(ev);
    const isActive =
      this._activeClip &&
      this._activeClip.media_content_id === ev.media_content_id;
    return html`
      <div
        class="row timeline-row ${isActive ? "active" : ""}"
        @pointerdown=${(e) => e.stopPropagation()}
      >
        <div
          class="text"
          @click=${(e) => { e.stopPropagation(); this._onTimelineMarkerClick(ev); }}
        >
          <div class="title-line">
            <span class="row-title">${titleText}</span>
            ${chip}
          </div>
          <div class="meta">
            ${timeStr}${camera ? html` · <span class="cam">${this._camName(camera)}</span>` : ""}
          </div>
          ${description
            ? html`<div class="desc">${description}</div>`
            : html`<div class="desc placeholder">${t.no_description}</div>`}
        </div>
        <div class="snap" @click=${(e) => {
          e.stopPropagation();
          this._openLightbox(ev, snapUrl);
        }}>
          ${snapUrl
            ? html`<img src="${snapUrl}" loading="lazy" alt="snapshot" @error=${(e) => (e.target.style.opacity = "0.3")} />`
            : html`<div class="noimg"><ha-icon icon="mdi:image-off"></ha-icon></div>`}
        </div>
      </div>
    `;
  }

  _renderEventList(filtered) {
    const t = this._t;
    return html`
      ${this._loading && this._events.length === 0
        ? html`<div class="loading">${t.loading_events}</div>`
        : ""}
      ${filtered.map((ev) => this._renderRow(ev))}
      ${!this._loading && filtered.length === 0
        ? html`<div class="empty">${t.no_events}</div>`
        : ""}
      <div class="footer">
        ${this._totalCap > (this._config.initial_events || 10)
          ? html`<button class="loadless" @click=${() => this._loadLess()} ?disabled=${this._loading}>
              ${t.load_less}
            </button>`
          : ""}
        <button class="loadmore" @click=${() => this._loadMore()} ?disabled=${this._loading}>
          ${this._loading
            ? `${t.loading_events.replace("…", "")}…`
            : `${t.load_more} (+${this._config.events_per_load})`}
        </button>
      </div>
    `;
  }

  _renderRefreshButton() {
    const t = this._t;
    return html`
      <button class="iconbtn" title="${t.refresh}" @click=${() => this._refresh()}>
        <ha-icon icon="mdi:refresh"></ha-icon>
      </button>
    `;
  }

  _renderFilters() {
    const t = this._t;
    const lang = detectLang(this.hass, this._config?.language);
    const labels = this._availableLabels();
    const cameras = this._availableCameras || [];
    const activeCount = this._activeLabels ? this._activeLabels.size : 0;
    const activeCamCount = this._activeCameras ? this._activeCameras.size : 0;
    const dateLabels = {
      all: t.filter_all,
      today: t.filter_today,
      yesterday: t.filter_yesterday,
      week: t.filter_week,
    };
    const showCameraFilter = cameras.length > 1;
    const configuredCams = this._configuredCameraIds();
    const showLiveCamPicker = !this._config.multiview && configuredCams.length > 1;
    return html`
      <div class="filters">
        ${showLiveCamPicker
          ? html`
              <div class="filter-dropdown">
                <button
                  class="filter-btn ${this._liveMode ? "active" : ""}"
                  @click=${() => {
                    this._showLiveCamMenu = !this._showLiveCamMenu;
                    if (this._showLiveCamMenu) {
                      this._showCameraMenu = false;
                      this._showLabelMenu = false;
                      this._showDateMenu = false;
                    }
                  }}
                >
                  <ha-icon icon="mdi:cctv"></ha-icon>
                  <span>${this._liveCamera ? this._camName(this._liveCamera) : t.live}</span>
                  <ha-icon icon="mdi:chevron-down"></ha-icon>
                </button>
                ${this._showLiveCamMenu
                  ? html`
                      <div class="filter-menu">
                        ${configuredCams.map(
                          (cam) => html`
                            <div
                              class="filter-menu-item ${this._liveCamera === cam ? "active" : ""}"
                              @click=${() => {
                                this._showLiveCamMenu = false;
                                if (this._liveCamera === cam && this._liveMode) return;
                                if (this._liveMode) {
                                  this._switchLiveCamera(cam);
                                } else {
                                  this._openLive(cam);
                                }
                              }}
                            >
                              <ha-icon
                                icon=${this._liveCamera === cam
                                  ? "mdi:radiobox-marked"
                                  : "mdi:radiobox-blank"}
                              ></ha-icon>
                              <span>${this._camName(cam)}</span>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : ""}
              </div>
            `
          : ""}

        ${showCameraFilter
          ? html`
              <div class="filter-dropdown">
                <button
                  class="filter-btn ${activeCamCount > 0 ? "active" : ""}"
                  @click=${() => this._toggleCameraMenu()}
                >
                  <ha-icon icon="mdi:camera-image"></ha-icon>
                  <span>
                    ${activeCamCount === 0
                      ? t.all_cameras
                      : activeCamCount === 1
                      ? this._camName(Array.from(this._activeCameras)[0])
                      : `${activeCamCount} ${t.cameras_plural}`}
                  </span>
                  <ha-icon icon="mdi:chevron-down"></ha-icon>
                </button>
                ${this._showCameraMenu
                  ? html`
                      <div class="filter-menu">
                        ${cameras.map(
                          (cam) => html`
                            <div
                              class="filter-menu-item ${this._activeCameras?.has(cam) ? "active" : ""}"
                              @click=${() => this._toggleCamera(cam)}
                            >
                              <ha-icon
                                icon=${this._activeCameras?.has(cam)
                                  ? "mdi:checkbox-marked"
                                  : "mdi:checkbox-blank-outline"}
                              ></ha-icon>
                              <span>${this._camName(cam)}</span>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : ""}
              </div>
            `
          : ""}

        <div class="filter-dropdown">
          <button
            class="filter-btn ${activeCount > 0 ? "active" : ""}"
            @click=${() => this._toggleLabelMenu()}
          >
            <ha-icon icon="mdi:tag-multiple-outline"></ha-icon>
            <span>
              ${activeCount === 0
                ? t.all_labels
                : activeCount === 1
                ? translateLabel(Array.from(this._activeLabels)[0], lang)
                : `${activeCount} ${t.labels_plural}`}
            </span>
            <ha-icon icon="mdi:chevron-down"></ha-icon>
          </button>
          ${this._showLabelMenu
            ? html`
                <div class="filter-menu">
                  ${labels.length === 0
                    ? html`<div class="filter-menu-empty">–</div>`
                    : labels.map(
                        (lbl) => html`
                          <div
                            class="filter-menu-item ${this._activeLabels?.has(lbl) ? "active" : ""}"
                            @click=${() => this._toggleLabel(lbl)}
                          >
                            <ha-icon
                              icon=${this._activeLabels?.has(lbl)
                                ? "mdi:checkbox-marked"
                                : "mdi:checkbox-blank-outline"}
                            ></ha-icon>
                            <span>${translateLabel(lbl, lang)}</span>
                          </div>
                        `
                      )}
                </div>
              `
            : ""}
        </div>

        <div class="filter-dropdown">
          ${this._config?.view_mode === "timeline"
            ? this._renderTimelineDayFilter(t, lang)
            : this._renderEventsDateFilter(t, dateLabels)}
        </div>

        ${this._config?.view_mode === "timeline"
          ? html`
              <button
                class="iconbtn"
                title="${t.timeline_zoom_out}"
                @click=${() => this._zoomTimelineStep(-1)}
              >
                <ha-icon icon="mdi:magnify-minus-outline"></ha-icon>
              </button>
              <button
                class="iconbtn"
                title="${t.timeline_zoom_in}"
                @click=${() => this._zoomTimelineStep(1)}
              >
                <ha-icon icon="mdi:magnify-plus-outline"></ha-icon>
              </button>
            `
          : ""}
        ${this._renderRefreshButton()}
      </div>
    `;
  }

  _renderEventsDateFilter(t, dateLabels) {
    return html`
      <button
        class="filter-btn ${this._dateFilter && this._dateFilter !== "all" ? "active" : ""}"
        @click=${() => this._toggleDateMenu()}
      >
        <ha-icon icon="mdi:calendar-outline"></ha-icon>
        <span>${dateLabels[this._dateFilter] || dateLabels.all}</span>
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </button>
      ${this._showDateMenu
        ? html`
            <div class="filter-menu">
              ${["all", "today", "yesterday", "week"].map(
                (k) => html`
                  <div
                    class="filter-menu-item ${this._dateFilter === k ? "active" : ""}"
                    @click=${() => this._setDateFilter(k)}
                  >
                    <ha-icon
                      icon=${this._dateFilter === k
                        ? "mdi:radiobox-marked"
                        : "mdi:radiobox-blank"}
                    ></ha-icon>
                    <span>${dateLabels[k]}</span>
                  </div>
                `
              )}
            </div>
          `
        : ""}
    `;
  }

  _renderTimelineDayFilter(t, lang) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({
        ms: d.getTime(),
        date: d,
      });
    }
    const pad = (n) => String(n).padStart(2, "0");
    const labelFor = (item) => {
      if (item.ms === todayMs) return t.filter_today;
      if (item.ms === todayMs - 86400000) return t.filter_yesterday;
      const weekday = item.date.toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { weekday: "short" });
      return `${weekday} ${pad(item.date.getDate())}.${pad(item.date.getMonth() + 1)}.`;
    };
    const selected = this._timelineSelectedDay;
    const buttonLabel = selected != null
      ? labelFor(days.find((d) => d.ms === selected) || { ms: selected, date: new Date(selected) })
      : t.filter_today;
    return html`
      <button
        class="filter-btn ${selected != null && selected !== todayMs ? "active" : ""}"
        @click=${() => this._toggleDateMenu()}
      >
        <ha-icon icon="mdi:calendar-outline"></ha-icon>
        <span>${buttonLabel}</span>
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </button>
      ${this._showDateMenu
        ? html`
            <div class="filter-menu">
              ${days.map((item) => {
                const isActive = (selected ?? todayMs) === item.ms;
                return html`
                  <div
                    class="filter-menu-item ${isActive ? "active" : ""}"
                    @click=${() => {
                      this._setTimelineSelectedDay(item.ms);
                      this._showDateMenu = false;
                    }}
                  >
                    <ha-icon
                      icon=${isActive ? "mdi:radiobox-marked" : "mdi:radiobox-blank"}
                    ></ha-icon>
                    <span>${labelFor(item)}</span>
                  </div>
                `;
              })}
            </div>
          `
        : ""}
    `;
  }

  _renderMultiview() {
    const t = this._t;
    const cameras = this._configuredCameraIds();
    if (!cameras.length) {
      return html`<div class="player-placeholder"><div>${t.no_events || "Keine Kameras konfiguriert"}</div></div>`;
    }
    const activeClip = this._activeClip;
    const clipCam = activeClip?._camera;
    const clipUrl = this._clipUrl || null;
    const isDesktop = this._cardWidth >= (this._config?.desktop_breakpoint || 800);
    const cols = isDesktop
      ? this._config.multiview_columns_desktop
      : this._config.multiview_columns_mobile;
    return html`
      <div class="multiview-grid" style="grid-template-columns: repeat(${cols}, 1fr);">
        ${cameras.map((camId) => html`
          <frigate-vision-live-tile
            class=${this._camEntry(camId)?.ultra_wide === true ? "multiview-tile-wide" : ""}
            .hass=${this.hass}
            .cameraId=${camId}
            .instanceId=${this._resolvedInstanceId}
            .cameraEntry=${this._camEntry(camId) || { name: camId }}
            .cardConfig=${this._config}
            .t=${t}
            .clipUrl=${clipCam === camId ? clipUrl : null}
            .clipError=${clipCam === camId ? this._clipError : null}
            .clipLoading=${clipCam === camId ? this._clipLoading : false}
            .clipSourceKind=${clipCam === camId ? this._clipSourceKind : null}
            .clipLoadToken=${clipCam === camId ? this._clipLoadToken : 0}
            .clipAttemptId=${clipCam === camId ? this._clipAttemptId : 0}
            @clip-source-loaded=${(event) => this._handleTileClipLoaded(event)}
            @clip-source-error=${(event) => this._handleTileClipError(event)}
            @close-clip=${() => this._closeClip()}
          ></frigate-vision-live-tile>
        `)}
      </div>
    `;
  }

  _renderPlayer() {
    const t = this._t;
    const showClip = !!this._activeClip;
    const showLive = this._liveMode && !showClip;
    const cameras = this._availableCameras || [];
    const showLiveButton = this._config.show_live_button
      && this._config.live_provider !== "off"
      && cameras.length > 0;

    if (!showClip && !showLive) {
      return html`
        <div class="player-placeholder">
          <ha-icon icon="mdi:play-circle-outline"></ha-icon>
          <div>${t.select_to_play}</div>
          ${showLiveButton ? html`
            <button class="live-btn" @click=${() => this._openLive()}>
              <ha-icon icon="mdi:cctv"></ha-icon>
              <span>${t.live}</span>
            </button>
          ` : ""}
        </div>
      `;
    }

    if (showLive) {
      const entry = this._camEntry(this._liveCamera);
      const hasHdSd = entry?.main && entry?.sub && entry.main !== entry.sub;
      return html`
        <div class="player-wrap live">
          ${this._liveLoading ? html`<div class="loading">${t.live_connecting}</div>` : ""}
          ${this._liveError ? html`<div class="error">${this._liveError}</div>` : ""}
          ${this._liveProvider === "mjpeg"
            ? (this._mjpegSignedUrl
                ? html`<img class="live-mjpeg" src="${this._mjpegSignedUrl}" @error=${() => this._onMjpegError()} />`
                : html`<div class="loading">${t.live_connecting}</div>`)
            : html`<video class="player" autoplay playsinline muted controls
                controlslist=${hasDoorbellOverlay(this._config, entry?.doorbell) && canFullscreenPlayer() ? "nofullscreen" : ""}></video>`
          }
          ${this._config.live_controls ? html`
            <div class="live-controls live-controls--${this._config.live_controls_position}">
              <span class="live-cam-name">${this._camName(this._liveCamera)}</span>
              <span class="live-indicator">
                <span class="live-dot"></span> LIVE
                ${this._liveProvider ? html`<span class="live-proto">${this._liveProvider.toUpperCase()}</span>` : ""}
                <span class="live-proto">${this._isExternal() ? "EXTERN" : "LAN"}</span>
              </span>
            </div>
          ` : ""}
          ${hasHdSd && this._config.hd_sd_button && this._config.hd_sd_button_position === "bottom" ? html`
            <button class="overlay-btn hd-sd-btn hd-sd-btn--bottom" @click=${() => this._toggleHD()} title="${this._isHD ? "HD Stream aktiv" : "SD Stream aktiv"}">
              <span class="hd-sd-label">${this._isHD ? "HD" : "SD"}</span>
            </button>
          ` : ""}
          <div class="player-top-buttons">
            ${this._liveProvider && !this._liveLoading && !this._liveError
              ? renderCameraControls(this.hass, this._config, this._resolvedInstanceId, this._liveCamera, this._lc, this._talkState, t, entry?.doorbell) : ""}
            ${hasHdSd && this._config.hd_sd_button && this._config.hd_sd_button_position === "top" ? html`
              <button class="overlay-btn hd-sd-btn" @click=${() => this._toggleHD()} title="${this._isHD ? "HD Stream aktiv" : "SD Stream aktiv"}">
                <span class="hd-sd-label">${this._isHD ? "HD" : "SD"}</span>
              </button>
            ` : ""}
            <button class="overlay-btn" @click=${() => this._closeLive()} title="${t.close}">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          ${this._liveProvider && !this._liveLoading && !this._liveError
            ? renderDoorbell(this.hass, this._config, this._liveCamera, this._lc, this._talkState, this._talkMuted, this._talkAudioBlocked, t, entry?.doorbell) : ""}
        </div>
      `;
    }

    return html`
      <div class="player-wrap">
        ${this._clipError
          ? html`<div class="error">${this._clipError}</div>`
          : ""}
        ${this._clipLoading && !this._clipError
          ? html`<div class="loading">${t.loading_clip}</div>`
          : ""}
        <video class="player" playsinline muted controls></video>
        <div class="player-top-buttons">
          ${showLiveButton ? html`
            <button class="overlay-btn" @click=${() => { this._disposeActiveClip(); this._openLive(); }} title="${t.live}">
              <ha-icon icon="mdi:cctv"></ha-icon>
            </button>
          ` : ""}
          <button class="overlay-btn" @click=${() => this._closeClip()} title="${t.close}">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  _renderLabelChip(rawLabel, displayLabel) {
    if (!rawLabel && !displayLabel) return "";
    const text = displayLabel || rawLabel;
    const icon = labelIcon(rawLabel, this._config?.label_icons);
    const color = labelColor(rawLabel, this._config?.label_colors);
    const style = color ? `--chip-color: ${color};` : "";
    const variant = this._config?.label_style || "soft";
    return html`
      <span class="chip chip-${variant}" style=${style}>
        ${icon ? html`<ha-icon class="chip-icon" icon=${icon}></ha-icon>` : ""}
        <span class="chip-text">${text}</span>
      </span>
    `;
  }

  _shortDesc(text) {
    if (!text) return "";
    const m = text.match(/^[^.!?\n]+[.!?]?/);
    return m ? m[0].trim() : text.substring(0, 120);
  }

  _eventTitle(ev, _lang, _t) {
    const detection = translateLabel(ev?._label || "", "de") || "Ereignis";
    const camera = this._camName(ev?._camera || "") || "Frigate";
    const subLabel = String(ev?._frigate?.subLabel || "").trim();
    const identity =
      String(ev?._label || "").trim().toLowerCase() === "person" && subLabel
        ? ` (${subLabel})`
        : "";
    return `${detection}${identity} in ${camera} wurde erkannt`;
  }

  _eventShortDesc(ev) {
    return this._shortDesc(this._eventFullDesc(ev));
  }

  _eventFullDesc(ev) {
    return (
      ev._frigate?.reviewScene ||
      ev._frigate?.reviewSummary ||
      ev._frigate?.description ||
      ""
    );
  }

  _renderRow(ev) {
    const t = this._t;
    const lang = detectLang(this.hass, this._config?.language);
    const title = this._eventTitle(ev, lang, t);
    const description = this._eventShortDesc(ev);
    const camera = ev._camera;
    const rawLabel = ev._label || "";
    const label = translateLabel(rawLabel, lang);
    const chip = this._renderLabelChip(rawLabel, label);
    const timeStr = formatTime(ev._ts, t);
    const snapUrl = this._snapshotUrl(ev);
    const isActive =
      this._activeClip &&
      this._activeClip.media_content_id === ev.media_content_id;

    return html`
      <div class="row ${isActive ? "active" : ""}">
        <div class="text" @click=${() => this._openClip(ev)}>
          <div class="title-line">
            <span class="row-title">${title}</span>
            ${chip}
          </div>
          <div class="meta">
            ${timeStr}${camera ? html` · <span class="cam">${this._camName(camera)}</span>` : ""}
          </div>
          ${description
            ? html`<div class="desc">${description}</div>`
            : html`<div class="desc placeholder">${t.no_description}</div>`}
        </div>
        <div class="snap" @click=${(e) => {
          e.stopPropagation();
          this._openLightbox(ev, snapUrl);
        }}>
          ${snapUrl
            ? html`<img
                src="${snapUrl}"
                loading="lazy"
                alt="snapshot"
                @error=${(e) => (e.target.style.opacity = "0.3")}
              />`
            : html`<div class="noimg"><ha-icon icon="mdi:image-off"></ha-icon></div>`}
        </div>
      </div>
    `;
  }

  _extractFilename(ev) {
    if (ev?.title) return ev.title;
    const id = ev?.media_content_id || "";
    if (!id) return "";
    const decoded = decodeURIComponent(id);
    const lastSlash = decoded.lastIndexOf("/");
    return lastSlash >= 0 ? decoded.substring(lastSlash + 1) : decoded;
  }

  _renderLightbox() {
    if (!this._lightbox) return "";
    const t = this._t;
    const lang = detectLang(this.hass, this._config?.language);
    const ev = this._lightbox.ev;
    const lbTitle = this._eventTitle(ev, lang, t);
    const lbDesc = this._eventFullDesc(ev);
    const lbLabel = translateLabel(ev._label || "", lang);
    const lbTime = formatTime(ev._ts, t);
    const lbCam = ev._camera;
    const lbFile = this._extractFilename(ev);
    return html`
      <dialog
        class="lightbox"
        @click=${(e) => {
          if (e.target === e.currentTarget) this._closeLightbox();
        }}
        @cancel=${(e) => {
          e.preventDefault();
          this._closeLightbox();
        }}
      >
        <div class="lightbox-inner" @click=${(e) => e.stopPropagation()}>
          <button class="lightbox-close" @click=${() => this._closeLightbox()}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
          <div class="lightbox-header">
            <div class="lightbox-title">${lbTitle}</div>
            <div class="lightbox-sub">
              ${lbTime}${lbCam ? html` · <span class="cam">${this._camName(lbCam)}</span>` : ""}
              ${lbLabel
                ? html` · ${this._renderLabelChip(
                    ev._label || "",
                    lbLabel
                  )}`
                : ""}
            </div>
          </div>
          <img src="${this._lightbox.url}" alt="snapshot" />
          <div class="lightbox-desc">
            ${lbDesc
              ? lbDesc
              : html`<span class="placeholder">${t.no_description}</span>`}
          </div>
          ${lbFile ? html`<div class="lightbox-file" title=${lbFile}><ha-icon icon="mdi:file-outline"></ha-icon> ${lbFile}</div>` : ""}
        </div>
      </dialog>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        height: 100%;
        --row-bg: var(--ha-card-background, var(--card-background-color, #fff));
        --row-border: var(--divider-color, #e0e0e0);
        --text-primary: var(--primary-text-color, #212121);
        --text-secondary: var(--secondary-text-color, #727272);
        --accent: var(--primary-color, #03a9f4);
      }
      ha-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        height: 100%;
      }
      .doorbell-view { width: 100%; max-width: 100%; margin-inline: auto; box-sizing: border-box; }
      .doorbell-view frigate-vision-live-tile { flex: 1; min-width: 0; min-height: 0; }
      .doorbell-message p { margin: 0; padding: 12px; }
      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        flex-wrap: wrap;
        flex-shrink: 0;
      }
      .title {
        font-size: 1.1em;
        font-weight: 500;
        line-height: 1.2;
        flex: 1 1 auto;
        min-width: 0;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .title ha-icon {
        vertical-align: middle;
      }
      .spacer {
        flex: 1;
      }
      .header .filters {
        flex: 1;
        justify-content: flex-end;
        padding: 0;
        border-bottom: none;
        gap: 6px;
      }
      .iconbtn {
        background: color-mix(in srgb, var(--text-primary) 6%, transparent);
        border: none;
        color: var(--text-primary);
        cursor: pointer;
        padding: 0;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        min-width: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 32px;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .iconbtn ha-icon {
        pointer-events: none;
      }
      .iconbtn:hover {
        background: color-mix(in srgb, var(--text-primary) 12%, transparent);
        color: var(--accent);
      }
      .split {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }
      .split.is-split {
        flex-direction: row;
        align-items: stretch;
      }
      .split > .left,
      .split > .right {
        min-width: 0;
        min-height: 0;
      }
      .split.is-stacked > .left,
      .split.is-stacked > .right {
        width: 100%;
      }
      .split.is-stacked > .left {
        flex: 0 0 auto;
        overflow: hidden;
      }
      .split.is-stacked > .left .player-wrap {
        overflow: hidden;
      }
      .split.is-stacked > .right {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 120px;
        overflow: hidden;
      }
      .split.is-split > .left {
        flex: 1.4 1 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        background: var(--row-bg);
        padding: 12px;
        box-sizing: border-box;
        overflow: hidden;
      }
      .split.is-split > .left .player-wrap {
        border-bottom: none;
        border-radius: 6px;
        overflow: hidden;
        flex: 0 0 auto;
      }
      .split.is-split > .left .player-placeholder {
        border-bottom: none;
        flex: 0 0 auto;
        min-height: 240px;
        border-radius: 6px;
      }
      .split.is-split > .left video.player {
        max-height: none;
        width: 100%;
        height: auto;
        object-fit: contain;
      }
      .split.is-split > .right {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
      .player-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        color: var(--text-secondary);
        background: rgba(0, 0, 0, 0.03);
      }
      .player-placeholder ha-icon {
        --mdc-icon-size: 48px;
        margin-bottom: 8px;
      }
      .player-wrap {
        position: relative;
        background: transparent;
      }
      .multiview-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 4px;
        min-width: 0;
      }
      .split.is-split > .left .multiview-grid {
        height: auto;
      }
      .multiview-grid > .multiview-tile-wide {
        grid-column: 1 / -1;
        min-width: 0;
      }
      video.player {
        display: block;
        width: 100%;
        max-height: 420px;
        background: transparent;
        object-fit: contain;
      }
      .split.is-split > .left video.player {
        max-height: none;
        height: 100%;
      }
      .overlay-btn {
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        border: none;
        border-radius: 50%;
        width: 34px;
        height: 34px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .overlay-btn:hover {
        background: rgba(0, 0, 0, 0.8);
      }
      .overlay-btn ha-icon {
        --mdc-icon-size: 20px;
        pointer-events: none;
      }
      .closebtn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .closebtn ha-icon {
        pointer-events: none;
      }
      .filters {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        flex-wrap: wrap;
        position: relative;
      }
      .filter-dropdown {
        position: relative;
      }
      .filter-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: color-mix(in srgb, var(--text-primary) 6%, transparent);
        color: var(--text-primary);
        border: none;
        padding: 7px 8px;
        min-height: 32px;
        border-radius: 10px;
        cursor: pointer;
        font: inherit;
        font-size: 0.82em;
        font-weight: 500;
        line-height: 1;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .filter-btn > ha-icon:last-child {
        --mdc-icon-size: 16px;
      }
      .filter-btn:hover {
        background: color-mix(in srgb, var(--accent) 15%, transparent);
        color: var(--accent);
      }
      .filter-dropdown:has(.filter-menu) .filter-btn {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        color: var(--accent);
      }
      .filter-btn.active {
        color: var(--accent);
      }
      .filter-btn.active::before {
        content: none;
      }
      .filter-btn ha-icon {
        --mdc-icon-size: 18px;
        flex-shrink: 0;
        color: var(--text-secondary);
      }
      .filter-btn:hover ha-icon,
      .filter-btn.active ha-icon,
      .filter-dropdown:has(.filter-menu) .filter-btn ha-icon {
        color: inherit;
      }
      .filter-btn > ha-icon:last-child {
        --mdc-icon-size: 16px;
        opacity: 0.55;
        margin-left: -2px;
      }
      .filter-btn > span {
        text-transform: capitalize;
        white-space: nowrap;
      }
      .filter-menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        background: var(--row-bg);
        border: 1px solid var(--row-border);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        padding: 4px;
        z-index: 10;
        min-width: 180px;
        max-height: 260px;
        overflow-y: auto;
      }
      .filter-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
      }
      .filter-menu-item > span {
        text-transform: capitalize;
      }
      .filter-menu-item:hover {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
      }
      .filter-menu-item.active {
        color: var(--accent);
      }
      .filter-menu-item ha-icon {
        --mdc-icon-size: 18px;
      }
      .filter-menu-empty {
        padding: 10px;
        color: var(--text-secondary);
        text-align: center;
      }
      .list-wrap {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        /* Let the actual ha-card surface (including themed gradients) show through. */
        background: transparent;
      }
      .list {
        display: flex;
        flex-direction: column;
      }
      .split.is-stacked > .right .filters {
        flex-shrink: 0;
      }
      .row {
        display: flex;
        gap: 12px;
        padding: 10px 12px;
        margin: 4px 8px;
        min-width: 0;
        border-radius: 10px;
        background: color-mix(in srgb, var(--text-primary) 4%, transparent);
        cursor: default;
        transition: background-color 120ms, transform 120ms, box-shadow 120ms;
      }
      .row:hover {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }
      .row.active {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
      }
      .text {
        flex: 1;
        min-width: 0;
        cursor: pointer;
      }
      .title-line {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
        min-width: 0;
        flex-wrap: wrap;
      }
      .row-title {
        font-weight: 500;
        color: var(--text-primary);
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .chip {
        --chip-color: var(--accent);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.78em;
        font-weight: 500;
        line-height: 1;
        padding: 4px 9px 4px 7px;
        border-radius: 999px;
        white-space: nowrap;
        letter-spacing: 0.1px;
        border: 1px solid transparent;
      }
      .chip-icon {
        --mdc-icon-size: 15px;
        flex-shrink: 0;
      }
      .chip-text {
        white-space: nowrap;
      }
      .chip-soft {
        background: color-mix(in srgb, var(--chip-color) 15%, transparent);
        color: var(--chip-color);
      }
      .chip-solid {
        background: var(--chip-color);
        color: #fff;
      }
      .chip-solid .chip-icon {
        color: #fff;
      }
      .chip-outline {
        background: transparent;
        color: var(--chip-color);
        border-color: color-mix(in srgb, var(--chip-color) 55%, transparent);
      }
      .meta {
        font-size: 0.78em;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .cam {
        text-transform: capitalize;
      }
      .desc {
        font-size: 0.88em;
        color: var(--text-primary);
        line-height: 1.3;
        overflow-wrap: anywhere;
      }
      .desc.placeholder {
        color: var(--text-secondary);
        font-style: italic;
      }
      .snap {
        flex: 0 0 120px;
        width: 120px;
        height: 72px;
        border-radius: 6px;
        overflow: hidden;
        background: #111;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .snap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .noimg {
        color: #888;
      }
      .loading,
      .empty {
        padding: 20px;
        text-align: center;
        color: var(--text-secondary);
      }
      .error {
        padding: 12px 16px;
        color: var(--error-color, #c62828);
        background: color-mix(in srgb, var(--error-color, #c62828) 10%, transparent);
      }
      .footer {
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: 12px;
      }
      .loadmore {
        background: var(--accent);
        color: var(--text-primary-color, #fff);
        border: none;
        padding: 8px 20px;
        border-radius: 18px;
        cursor: pointer;
        font-weight: 500;
      }
      .loadmore:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .loadless {
        background: color-mix(in srgb, var(--text-primary) 6%, transparent);
        color: var(--text-primary);
        border: none;
        padding: 8px 20px;
        border-radius: 18px;
        cursor: pointer;
        font-weight: 500;
      }
      .loadless:hover {
        background: color-mix(in srgb, var(--text-primary) 12%, transparent);
      }
      .loadless:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      /* Native <dialog> with showModal() lifts the lightbox into the
         browser's top layer — escapes any parent that has transform /
         filter / will-change (which would otherwise pin position:fixed
         to the parent instead of the viewport, leaving the backdrop
         only over the card).
         The dialog is explicitly sized to 100vw/100vh and inset:0 so
         the inner content can be centered in the actual viewport via
         flex (UA default would auto-size + add top margin, leaving
         the popup floating near the top of the screen). */
      .lightbox {
        border: none;
        outline: none;
        inset: 0;
        width: 100vw;
        height: 100vh;
        max-width: 100vw;
        max-height: 100vh;
        margin: 0;
        padding: 20px;
        background: transparent;
        color: inherit;
        box-sizing: border-box;
      }
      .lightbox[open] {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .lightbox::backdrop {
        background: rgba(0, 0, 0, 0.6);
      }
      .lightbox-inner {
        position: relative;
        width: min(960px, calc(100vw - 40px));
        max-height: calc(100vh - 40px);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        color: var(--primary-text-color);
        border-radius: var(--ha-card-border-radius, 12px);
        padding: 20px 24px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        overflow-y: auto;
        overflow-x: hidden;
      }
      .lightbox-header {
        margin-bottom: 12px;
        color: var(--primary-text-color);
        padding-right: 44px;
        max-width: 100%;
        box-sizing: border-box;
      }
      .lightbox-title {
        font-size: 1.15em;
        font-weight: 600;
      }
      .lightbox-sub {
        margin-top: 4px;
        font-size: 0.85em;
        color: var(--secondary-text-color);
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .lightbox-sub .chip-soft {
        background: color-mix(in srgb, var(--chip-color) 25%, transparent);
        color: var(--chip-color);
      }
      .lightbox-sub .chip-solid {
        background: var(--chip-color);
        color: #fff;
      }
      .lightbox-sub .chip-solid .chip-icon {
        color: #fff;
      }
      .lightbox-sub .chip-outline {
        background: transparent;
        color: var(--chip-color);
        border-color: color-mix(in srgb, var(--chip-color) 55%, transparent);
      }
      .lightbox-inner img {
        max-width: 100%;
        max-height: 65vh;
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 8px;
        display: block;
        margin: 0 auto;
      }
      .lightbox-desc {
        margin-top: 14px;
        color: var(--primary-text-color);
        font-size: 0.92em;
        line-height: 1.45;
        max-width: 100%;
        box-sizing: border-box;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      .lightbox-file {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
        color: var(--secondary-text-color);
        font-size: 0.78em;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        display: flex;
        align-items: center;
        gap: 6px;
        word-break: break-all;
      }
      .lightbox-file ha-icon {
        --mdc-icon-size: 14px;
        flex-shrink: 0;
      }
      .lightbox-desc .placeholder {
        color: var(--secondary-text-color);
        font-style: italic;
      }
      .lightbox-close {
        position: absolute;
        top: 10px;
        right: 10px;
        background: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
        color: var(--primary-text-color);
        border: none;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
      }
      .lightbox-close:hover {
        background: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
      }

      /* ── Livestream styles ── */
      .live-btn {
        margin-top: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border-radius: 20px;
        border: 1px solid var(--accent);
        background: transparent;
        color: var(--accent);
        cursor: pointer;
        font-size: 0.9em;
        transition: background 0.2s;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .live-btn:hover {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
      }
      .live-btn ha-icon {
        --mdc-icon-size: 18px;
        pointer-events: none;
      }
      .live-controls {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        color: #fff;
        font-size: 0.85em;
        pointer-events: auto;
      }
      .live-controls--bottom {
        bottom: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
      }
      .live-controls--top {
        top: 0;
        background: linear-gradient(rgba(0,0,0,0.7), transparent);
      }
      .live-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
      }
      .live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #f44336;
        animation: live-pulse 1.5s ease-in-out infinite;
      }
      @keyframes live-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .live-proto {
        font-size: 0.75em;
        opacity: 0.7;
        font-weight: 400;
      }
      .live-cam-name {
        font-weight: 500;
      }
      .live-mjpeg {
        display: block;
        width: 100%;
        max-height: 420px;
        object-fit: contain;
        background: transparent;
      }
      .player-top-buttons {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 6px;
        z-index: 2;
      }
      .hd-sd-btn {
        border-radius: 6px !important;
        min-width: 38px;
      }
      .hd-sd-btn--bottom {
        position: absolute;
        bottom: 8px;
        right: 8px;
        z-index: 3;
      }
      .hd-sd-label {
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.5px;
        line-height: 1;
      }
      .player-wrap.live {
        position: relative;
        background: transparent;
      }
      .player-wrap.live video.player {
        max-height: 420px;
      }
      .split.is-split > .left .live-mjpeg {
        max-height: none;
        height: auto;
        object-fit: contain;
      }
      .split.is-split > .left .player-wrap.live video.player {
        max-height: none;
        height: auto;
      }
      .player-wrap.live:fullscreen { width: 100%; height: 100%; background: black; }
      .player-wrap.live:fullscreen :is(video.player, .live-mjpeg) {
        width: 100% !important; height: 100% !important; max-height: none !important; object-fit: contain;
      }

      /* ── Timeline (VoD recording) ── */
      .timeline-player-wrap {
        position: relative;
        background: transparent;
      }
      video.timeline-player {
        display: block;
        width: 100%;
        max-height: 420px;
        background: #000;
        object-fit: contain;
      }
      .split.is-split > .left video.timeline-player {
        max-height: none;
        height: 100%;
      }
      .timeline-wrap {
        flex: 1 1 0;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding: 8px;
        box-sizing: border-box;
      }
      /* In stacked layout the timeline still wants room for a 24h vertical
         axis — give it a sensible minimum so it doesn't collapse to a
         100px-strip under the player */
      .split.is-stacked > .right .timeline-wrap {
        min-height: 360px;
      }
      .timeline-wrap.timeline-vertical {
        flex-direction: column;
      }
      .timeline-track {
        position: relative;
        background: color-mix(in srgb, var(--text-primary) 6%, transparent);
        border-radius: 8px;
        cursor: grab;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
      }
      .timeline-track--dragging {
        cursor: grabbing;
      }
      /* Body wraps the (clickable) track and the (visual) marker lane */
      .timeline-body {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
      }
      .timeline-body.timeline-horizontal { flex-direction: column; }
      .timeline-body.timeline-vertical   { flex-direction: row; }

      /* Track: only the clickable axis bar — pan/seek/wheel happen here */
      .timeline-track.timeline-horizontal {
        height: 32px;
        min-height: 32px;
        flex: 0 0 32px;
        border-radius: 8px 8px 0 0;
      }
      .timeline-track.timeline-vertical {
        width: 144px;
        min-width: 144px;
        flex: 0 0 144px;
        border-radius: 8px 0 0 8px;
        overflow: visible;
      }
      /* Stacked layout (mobile): narrower track (60px). The label is
         centered on the axis line (instead of right-edge inside) and
         keeps full 1em size with a small card-colored "pill" so it
         masks the axis line + any event bar passing behind it. */
      .split.is-stacked > .right .timeline-track.timeline-vertical {
        width: 60px;
        min-width: 60px;
        flex: 0 0 60px;
      }
      .split.is-stacked > .right .timeline-vertical .timeline-tick-label {
        right: auto;
        left: 50%;
        font-size: 1em;
        transform: translate(-50%, -50%);
        padding: 1px 5px;
        border-radius: 4px;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        z-index: 2;
      }

      /* Flipped layout: events list on the left, axis on the right */
      .timeline-body.timeline-flipped {
        flex-direction: row-reverse;
      }
      .timeline-flipped .timeline-track.timeline-vertical {
        border-radius: 0 8px 8px 0;
      }
      .timeline-flipped .timeline-event-list {
        border-radius: 8px 0 0 8px;
      }
      /* Mirror the tick: hangs to the right of the axis line */
      .timeline-flipped .timeline-vertical .timeline-tick {
        transform: translate(0, -50%);
      }
      /* Mirror the label: hangs just right of the axis line, inside the track */
      .timeline-flipped .timeline-vertical .timeline-tick-label {
        right: auto;
        left: 2px;
      }

      /* Event list to the right of the timeline axis (scrollable) */
      .timeline-event-list {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        display: flex;
        flex-direction: column;
        gap: 6px;
        /* Extra bottom padding so the last row's shadow isn't clipped
           when the user scrolls all the way down inside a fixed-height
           container (mobile_height / desktop_height). */
        padding: 4px 6px 14px 8px;
        background: color-mix(in srgb, var(--text-primary) 3%, transparent);
        border-radius: 0 8px 8px 0;
      }
      .timeline-event-list > .row {
        margin: 0;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        flex-shrink: 0;
      }
      .timeline-event-list > .row:hover {
        border-color: color-mix(in srgb, var(--accent) 50%, var(--divider-color));
      }
      .timeline-event-list .timeline-empty {
        padding: 24px 12px;
        text-align: center;
        color: var(--text-secondary);
        font-size: 0.85em;
      }

      .timeline-axis {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      /* Continuous vertical axis line through the center of the track */
      .timeline-axis-line {
        position: absolute;
        background: color-mix(in srgb, var(--text-secondary, #888) 40%, transparent);
        pointer-events: none;
      }
      .timeline-track.timeline-vertical .timeline-axis-line {
        top: 0;
        bottom: 0;
        left: 50%;
        width: 2px;
        transform: translateX(-50%);
      }
      .timeline-track.timeline-horizontal .timeline-axis-line {
        left: 0;
        right: 0;
        top: 50%;
        height: 2px;
        transform: translateY(-50%);
      }
      /* Event markers — short bars crossing the axis line at event positions */
      .timeline-event-marks {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .timeline-event-mark {
        position: absolute;
        --bar-color: #facc15;
        background: var(--bar-color);
        border-radius: 1px;
        opacity: 0.9;
      }
      .timeline-track.timeline-vertical .timeline-event-mark {
        left: 50%;
        height: 2px;
        width: 18px;
        transform: translate(-50%, -50%);
      }
      .timeline-track.timeline-horizontal .timeline-event-mark {
        top: 50%;
        width: 2px;
        height: 18px;
        transform: translate(-50%, -50%);
      }
      .timeline-tick {
        position: absolute;
        font-size: 0.7em;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }
      .timeline-horizontal .timeline-tick {
        top: 0;
        bottom: 0;
        transform: translateX(-50%);
        width: 1px;
        background: color-mix(in srgb, var(--text-secondary) 25%, transparent);
      }
      .timeline-horizontal .timeline-tick-label {
        position: absolute;
        top: 4px;
        left: 4px;
        white-space: nowrap;
      }
      .timeline-vertical .timeline-tick {
        left: 50%;
        width: 10px;
        transform: translate(-100%, -50%);
        height: 1px;
        background: color-mix(in srgb, var(--text-secondary) 35%, transparent);
      }
      .timeline-vertical .timeline-tick-label {
        position: absolute;
        /* Label rechts edge sits just left of the axis line (tick's right
           edge), so the whole label stays inside the track even when the
           track is narrow. The thin tick line gets covered, which is fine. */
        right: 2px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 1em;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        color: var(--primary-text-color, var(--text-primary));
      }
      .timeline-indicator {
        position: absolute;
        background: #ef4444;
        z-index: 5;
        pointer-events: none;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      }
      .timeline-horizontal .timeline-indicator {
        top: -4px;
        bottom: -4px;
        width: 3px;
        transform: translateX(-1.5px);
      }
      .timeline-vertical .timeline-indicator {
        left: -8px;
        right: -8px;
        height: 3px;
        transform: translateY(-1.5px);
      }
      .timeline-indicator-time {
        position: absolute;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        font-size: 0.74em;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        padding: 3px 7px;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      }
      .timeline-vertical .timeline-indicator-time {
        left: 50%;
        top: 100%;
        margin-top: 5px;
        transform: translateX(-50%);
      }
      .timeline-horizontal .timeline-indicator-time {
        top: 100%;
        left: 50%;
        margin-top: 5px;
        transform: translateX(-50%);
      }
      /* Slimmer snapshot in the timeline list to fit narrower split panes */
      .timeline-event-list .row .snap {
        flex: 0 0 84px;
        width: 84px;
        height: 64px;
      }
      .timeline-event-list .row .desc {
        font-size: 0.82em;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .timeline-empty {
        padding: 12px;
        text-align: center;
        color: var(--text-secondary);
        font-size: 0.85em;
      }

      @media (max-width: 560px) {
        .snap {
          flex-basis: 96px;
          width: 96px;
          height: 64px;
        }
        .filters {
          gap: 4px;
          padding: 6px 8px;
        }
        .filter-btn {
          padding: 6px 7px;
          font-size: 0.78em;
          gap: 4px;
        }
        .filter-btn > ha-icon:last-child {
          display: none;
        }
        .filter-btn.active::before {
          content: none;
        }
        .title {
          justify-content: flex-end;
        }
        .player-wrap {
          padding: 4px;
          background: var(--row-bg);
        }
        .player-wrap video.player {
          border-radius: 6px;
        }
      }
    `;
  }

  static getConfigElement() {
    return document.createElement("frigate-vision-card-editor");
  }

  static getStubConfig() {
    return {
      cameras: "all",
      initial_events: 10,
      events_per_load: 10,
      layout: "auto",
      language: "auto",
      label_style: "soft",
    };
  }
}

const EDITOR_LABELS = [
  "person", "car", "dog", "cat", "bird", "bicycle",
  "motorcycle", "package", "truck", "bus", "mouse",
  "face", "license_plate", "amazon", "dhl", "ups",
];

function editorString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Frigate exposes camera_name and client_id on its camera entities. Use the
// states visible to this HA user, not entity-id guesses, recordings or an NVR API.
const cameraGroupCache = new WeakMap();
function frigateCameraGroups(hass) {
  const cached = cameraGroupCache.get(hass?.states);
  if (cached && cached.registry === hass.entities) return cached.groups;
  const groups = new Map();
  for (const [entityId, state] of Object.entries(hass?.states || {})) {
    if (!entityId.startsWith("camera.")) continue;
    const platform = hass.entities?.[entityId]?.platform;
    if (platform && platform !== "frigate") continue;
    const { camera_name, client_id, friendly_name } = state?.attributes || {};
    const clientId = editorString(client_id);
    const id = editorString(camera_name).toLowerCase();
    if (!id || !clientId) continue;
    if (!groups.has(clientId)) groups.set(clientId, new Map());
    const cameras = groups.get(clientId);
    if (cameras.has(id)) cameras.get(id).ambiguous = true;
    else cameras.set(id, { name: editorString(friendly_name) || id, cameraName: camera_name, entityId });
  }
  // All multiview tiles share one scan of the current HA state snapshot.
  if (hass?.states) cameraGroupCache.set(hass.states, { registry: hass.entities, groups });
  return groups;
}

// Native, labelled controls also work when HA hasn't registered its internal
// form elements (notably ha-textfield and ha-formfield on newer frontends).
function editorInput(label, value, change, { type = "text", placeholder = "", min = "", max = "", step = "", hint = "", onInput } = {}) {
  return html`<label class="field editor-input">
    <span>${label}</span>
    <input type=${type} .value=${String(value ?? "")} placeholder=${placeholder}
      min=${min} max=${max} step=${step} aria-describedby=${hint}
      @input=${onInput} @change=${(e) => change(e.target.value, e.target)} />
  </label>`;
}

function editorSwitch(label, checked, change, hint = "") {
  return html`<label class="editor-switch">
    <input type="checkbox" role="switch" .checked=${checked} aria-describedby=${hint}
      @change=${(e) => change(e.target.checked)} />
    <span>${label}</span>
  </label>`;
}

class FrigateVisionCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { state: true },
      _expandedSection: { state: true },
      _cameraEntries: { state: true },
      _expandedCam: { state: true },
    };
  }

  constructor() {
    super();
    this._config = {};
    this._expandedSection = "general";
    this._cameraEntries = [];
    this._expandedCam = null;
  }

  setConfig(config) {
    const { multiview_columns: _deprecatedMultiviewColumns, ...cleanConfig } = config || {};
    this._config = { ...cleanConfig };
    this._buildCameraEntries(cleanConfig);
  }

  _buildCameraEntries(config) {
    const map = FrigateVisionCard._normalizeCamerasMap(config);
    this._cameraEntries = Object.entries(map).map(([id, { name, main, sub, ultra_wide, doorbell, ...extra }]) => ({
      id, displayName: name || "", main: main || "", sub: sub || "",
      ultraWide: ultra_wide === true, doorbell, extra,
    }));
  }

  _addCamera(id = "") {
    const entries = [...this._cameraEntries];
    if (id && entries.some((entry) => entry.id === id)) return;
    let idx = entries.findIndex((entry) => !entry.id);
    if (idx < 0) {
      idx = entries.length;
      entries.push({ id, displayName: "", main: "", sub: "", ultraWide: false });
    } else if (id) {
      entries[idx] = { ...entries[idx], id };
    }
    this._cameraEntries = entries;
    this._expandedCam = idx;
    // Only a deliberate addition may auto-fill; expanding a saved row must
    // never write configuration. HA may echo setConfig after config-changed.
    this._prefillEntity = this._cameraGroups?.get(this._editorClientId)?.get(id)?.entityId;
    if (id) this._applyCameraEntries();
  }

  _updateCamera(idx, patch) {
    this._cameraEntries = this._cameraEntries.map((entry, i) => i === idx ? { ...entry, ...patch } : entry);
    if (this._cameraEntries[idx].id || "id" in patch) this._applyCameraEntries();
  }

  _applyCameraEntries() {
    const cameras = {};
    for (const e of this._cameraEntries) {
      const id = (e.id || "").trim().toLowerCase();
      if (!id) continue;
      const entry = { ...e.extra };
      if (e.displayName) entry.name = e.displayName;
      if (e.main) entry.main = e.main;
      if (e.sub) entry.sub = e.sub;
      // Only enabled cameras write the field, so old configs stay unchanged.
      if (e.ultraWide === true) entry.ultra_wide = true;
      if (e.doorbell) entry.doorbell = normalizeDoorbell(e.doorbell);
      Object.defineProperty(cameras, id, { value: entry, enumerable: true, configurable: true, writable: true });
    }
    const newConfig = { ...this._config };
    if (Object.keys(cameras).length) {
      newConfig.cameras = cameras;
    } else {
      delete newConfig.cameras;
    }
    this._config = newConfig;
    this._dispatch();
  }

  _dispatch() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: { ...this._config } },
        bubbles: true,
        composed: true,
      })
    );
  }

  _set(key, value) {
    if (value === "" || value === undefined || value === null) {
      const c = { ...this._config };
      delete c[key];
      this._config = c;
    } else {
      this._config = { ...this._config, [key]: value };
    }
    this._dispatch();
  }

  _toggleSection(name) {
    this._expandedSection = this._expandedSection === name ? null : name;
  }

  willUpdate() {
    this._syncCameraProfile();
    this._cameraGroups = this._expandedSection === "cameras" ? frigateCameraGroups(this.hass) : null;
    this._editorClientId = editorString(this._config.frigate_client_id) || this._cameraProfile?.clientId;
    if (!this._editorClientId && !this._cameraProfile?.pending && !editorString(this._config.frigate_vision_entry_id) && this._cameraGroups?.size === 1) {
      this._editorClientId = this._cameraGroups.keys().next().value;
    }
    this._syncStreamLookup();
  }

  _syncCameraProfile() {
    const hass = this.hass;
    if (this._expandedSection !== "cameras" || editorString(this._config.frigate_client_id) || !hass?.callWS) {
      this._cameraProfile = null;
      return;
    }
    const connection = hass.connection || hass.callWS;
    const entryId = editorString(this._config.frigate_vision_entry_id);
    if (this._cameraProfile?.connection === connection && this._cameraProfile.entryId === entryId) return;
    const lookup = { connection, entryId, pending: true, clientId: "" };
    this._cameraProfile = lookup;
    this._resolveCameraProfile(hass, lookup);
  }

  async _resolveCameraProfile(hass, lookup) {
    try {
      const message = { type: "frigate_vision/profile" };
      if (lookup.entryId) message.entry_id = lookup.entryId;
      const result = await hass.callWS(message);
      lookup.clientId = editorString((result?.profile || result)?.frigate_client_id);
    } catch {
      // A standalone Card has no profile. Never substitute a different
      // instance for an explicitly selected but unavailable profile.
    } finally {
      lookup.pending = false;
      if (this._cameraProfile === lookup) this.requestUpdate();
    }
  }

  _syncStreamLookup() {
    const cameraId = this._cameraEntries[this._expandedCam]?.id;
    const client = this._editorClientId;
    const entity = this._cameraGroups?.get(client)?.get(cameraId)?.entityId;
    const connection = this.hass?.connection || this.hass?.callWS;
    const profile = editorString(this._config.frigate_vision_entry_id);
    const previous = this._streamLookup;
    if (!entity || !this.hass?.callWS) {
      this._streamLookup = null;
    } else if (!previous || previous.entity !== entity || previous.client !== client || previous.profile !== profile || previous.connection !== connection || previous.cameraId !== cameraId) {
      const auto = this._prefillEntity === entity ? new Set(["main", "sub"]) : null;
      const lookup = { entity, client, profile, connection, cameraId, auto, pending: true };
      this._streamLookup = lookup;
      this._fetchStreamOptions(lookup);
    }
    this._prefillEntity = null;
  }

  async _fetchStreamOptions(lookup) {
    try {
      const result = await this.hass.callWS({ type: "frigate_vision/camera_streams", entity_id: lookup.entity, instance_id: lookup.client });
      if (Array.isArray(result?.streams)) lookup.options = result;
    } catch {
      // Older backend, unloaded entry or no read permission: keep manual input.
    } finally {
      lookup.pending = false;
      if (this._streamLookup === lookup) this.requestUpdate();
    }
  }

  updated() {
    // willUpdate has revalidated the camera, instance and HA connection even
    // if a config change raced the network reply in the same microtask.
    const lookup = this._streamLookup;
    if (this.isConnected && lookup?.auto && !lookup.pending) {
      const fields = lookup.auto;
      lookup.auto = null;
      this._applyStreamSuggestions(fields);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._streamLookup = null;
    this._prefillEntity = null;
  }

  _streamSuggestions(entry) {
    const options = this._streamLookup?.options;
    return Object.fromEntries(["main", "sub"].filter(role =>
      !entry[role] && options?.streams.includes(options[role]) && typeof options[role] === "string"
    ).map(role => [role, options[role]]));
  }

  _applyStreamSuggestions(fields) {
    const idx = this._expandedCam;
    const entry = this._cameraEntries[idx];
    if (!entry || entry.id !== this._streamLookup?.cameraId) return;
    const patch = this._streamSuggestions(entry);
    for (const role of Object.keys(patch)) if (fields && !fields.has(role)) delete patch[role];
    if (Object.keys(patch).length) this._updateCamera(idx, patch);
  }

  get _lang() {
    return detectLang(this.hass, this._config?.language);
  }

  render() {
    if (!this._config) return html``;
    return html`
      <div class="editor">
        ${this._renderSection("general", "Allgemein", "mdi:cog", this._renderGeneral)}
        ${this._renderSection("cameras", "Kameras", "mdi:cctv", this._renderCameras)}
        ${this._renderSection("display", "Anzeige", "mdi:monitor", this._renderDisplay)}
        ${this._renderSection("filters", "Filter & Sprache", "mdi:filter", this._renderFilters)}
        ${this._renderSection("labels", "Labels", "mdi:tag-multiple", this._renderLabels)}
        ${this._renderSection("livestream", "Livestream", "mdi:cctv", this._renderLivestream)}
        ${this._renderSection("advanced", "Erweitert", "mdi:tune", this._renderAdvanced)}
      </div>
    `;
  }

  _renderSection(id, title, icon, renderBody) {
    const open = this._expandedSection === id;
    return html`
      <div class="section ${open ? "open" : ""}">
        <button type="button" class="section-header" aria-expanded=${String(open)} @click=${() => this._toggleSection(id)}>
          <ha-icon icon=${icon}></ha-icon>
          <span>${title}</span>
          <ha-icon class="chevron" icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
        </button>
        ${open ? html`<div class="section-body">${renderBody.call(this)}</div>` : ""}
      </div>
    `;
  }

  _renderGeneral() {
    const cfg = this._config;
    return html`
      ${editorSwitch("Titel anzeigen", cfg.show_title !== false, (v) => this._set("show_title", v))}
      ${editorInput("Titel", cfg.title ?? "auto", (v) => this._set("title", v || "auto"), { placeholder: "auto" })}

      <ha-icon-picker
        label="Titel Icon"
        .value=${cfg.title_icon || ""}
        @value-changed=${(e) => this._set("title_icon", e.detail?.value || undefined)}
      ></ha-icon-picker>

      <div class="row">
        ${editorInput("Initiale Events", cfg.initial_events ?? 10, (v) => this._set("initial_events", Number(v) || 10), { type: "number" })}
        ${editorInput("Events pro Nachladen", cfg.events_per_load ?? 10, (v) => this._set("events_per_load", Number(v) || 10), { type: "number" })}
      </div>
      ${editorInput("Frigate Vision Entry-ID (optional)", cfg.frigate_vision_entry_id, (v) => this._set("frigate_vision_entry_id", v.trim()), { placeholder: "Nur bei mehreren Frigate-Vision-Instanzen" })}
      ${editorInput("Frigate Client-ID", cfg.frigate_client_id, (v) => this._set("frigate_client_id", v.trim()), { placeholder: "Automatisch" })}
    `;
  }

  _renderCameraPicker() {
    if (this._cameraProfile?.pending) return html`<p class="hint">Frigate-Instanz wird ermittelt …</p>`;
    const groups = this._cameraGroups;
    const client = this._editorClientId;
    if (!client && editorString(this._config.frigate_vision_entry_id)) {
      return html`<p class="hint">Das gewählte Frigate-Vision-Profil ist nicht verfügbar. Prüfe die Entry-ID unter „Allgemein“.</p>`;
    }
    if (!client && groups.size > 1) {
      return html`<label class="field"><span>Frigate-Instanz auswählen</span>
        <select @change=${(e) => this._set("frigate_client_id", e.target.value)}>
          <option value="" disabled selected>Instanz auswählen …</option>
          ${[...groups.keys()].sort().map((id) => html`<option value=${id}>${id}</option>`)}
        </select></label>`;
    }
    const cameras = groups.get(client);
    if (!cameras?.size) return html`<p class="hint">Keine Frigate-Kameras für diese Instanz in Home Assistant gefunden. Du kannst die Kamera-ID manuell eingeben.</p>`;
    const selected = new Set(this._cameraEntries.map((entry) => entry.id));
    return html`<label class="field"><span>Kamera aus Frigate hinzufügen</span>
      <select @change=${(e) => { const id = e.target.value; e.target.value = ""; this._addCamera(id); }}>
        <option value="" disabled selected>Kamera auswählen …</option>
        ${[...cameras].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, { name }]) => html`
          <option value=${id} ?disabled=${selected.has(id)}>${name === id ? id : `${name} (${id})`}</option>`)}
      </select></label>`;
  }

  _renderCameraStreams(entry, idx) {
    const lookup = this._streamLookup;
    const streams = lookup?.options?.streams || [];
    const useSelect = streams.length > 0 && !lookup.manual;
    return html`
      <div class="row">${[["main", "Main-Stream (HD)"], ["sub", "Sub-Stream (SD)"]].map(([role, label]) => {
        const value = entry[role] || "";
        const change = v => this._updateCamera(idx, { [role]: v.trim() });
        if (!useSelect) return editorInput(label, value, change, { placeholder: "Streamname", onInput: () => {
          // Don't replace a still-focused draft while a delayed lookup finishes.
          if (lookup) { lookup.manual = true; lookup.auto?.delete(role); }
        } });
        const choices = value && !streams.includes(value) ? [value, ...streams] : streams;
        return html`<label class="field"><span>${label}</span><select @change=${(e) => change(e.target.value)}>
          <option value="" ?selected=${!value}>Nicht festgelegt</option>
          ${choices.map(name => html`<option value=${name} ?selected=${value === name}>${name}</option>`)}
        </select></label>`;
      })}</div>
      <p class="hint">Main wird für die HD-Ansicht verwendet, Sub für die Kachel. ${lookup?.pending ? "Streamnamen werden geladen …" : !lookup?.options ? "Keine Streamvorschläge verfügbar; Namen können manuell eingetragen werden." : !streams.length ? "Für diese Kamera sind keine passenden Streamnamen hinterlegt." : ""}</p>
      ${streams.length ? html`<div class="stream-actions">
        <button type="button" class="add-btn" @click=${() => { lookup.manual = !lookup.manual; this.requestUpdate(); }}>${useSelect ? "Namen manuell eingeben" : "Streamliste anzeigen"}</button>
        ${Object.keys(this._streamSuggestions(entry)).length ? html`<button type="button" class="add-btn" @click=${() => this._applyStreamSuggestions()}>Vorschläge für leere Felder übernehmen</button>` : ""}
      </div>` : ""}
    `;
  }

  _renderDoorbellCameraPicker() {
    const camera = editorString(this._config.doorbell_camera).toLowerCase();
    const entries = this._cameraEntries.filter(entry => entry.id);
    const invalid = doorbellViewError(this._config, FrigateVisionCard._normalizeCamerasMap(this._config), camera);
    return html`<div class="field"><label for="doorbell-camera">Doorbell-Kamera</label>
      <select id="doorbell-camera" aria-describedby="doorbell-camera-hint" aria-invalid=${String(!!invalid)} @change=${(e) => {
        const id = e.target.value;
        this._set("doorbell_camera", id);
        const idx = this._cameraEntries.findIndex(entry => entry.id === id);
        if (idx >= 0) this._expandedCam = idx;
      }}>
        <option value="" ?selected=${!camera}>Kamera auswählen …</option>
        ${camera && !entries.some(entry => entry.id === camera) ? html`<option value=${camera} selected>${camera} (nicht konfiguriert)</option>` : ""}
        ${entries.map(({ id, displayName }) => html`<option value=${id} ?selected=${id === camera}>${displayName ? `${displayName} (${id})` : id}</option>`)}
      </select></div>
      <p id="doorbell-camera-hint" class="hint" role=${invalid ? "alert" : "note"}>${invalid ? DOORBELL_VIEW_MESSAGES.de[invalid] : "Nur diese Kamera wird angezeigt. Andere Kameraeinträge bleiben gespeichert."}</p>
      ${editorSwitch("Vorhandenen Ruf beim Öffnen übernehmen (nur Klingel-Popup)", this._config.doorbell_ring_on_mount === true,
        checked => this._set("doorbell_ring_on_mount", checked), "doorbell-mount-hint")}
      <p id="doorbell-mount-hint" class="hint">Nur aktivieren, wenn das Dashboard das Popup bei der Klingelflanke öffnet. Die Karte öffnet selbst kein Popup.</p>`;
  }

  _renderCameras() {
    const entries = this._cameraEntries;
    const doorbellOnly = this._config.view_mode === "doorbell";
    return html`
      ${doorbellOnly ? this._renderDoorbellCameraPicker() : ""}
      ${this._renderCameraPicker()}
      ${!doorbellOnly ? html`<p class="hint">Ohne Auswahl zeigt die Karte alle Kameras der gewählten Frigate-Instanz.</p>` : ""}

      ${entries.map((entry, idx) => {
        const isOpen = this._expandedCam === idx;
        const label = entry.displayName || entry.id || `Kamera ${idx + 1}`;
        const doorbell = entry.doorbell || normalizeDoorbell({});
        const changeDoorbell = (patch) => this._updateCamera(idx, { doorbell: normalizeDoorbell({ ...doorbell, ...patch }) });
        return html`
          <div class="cam-entry ${isOpen ? "open" : ""}">
            <div class="cam-entry-header">
              <button type="button" class="cam-toggle" aria-expanded=${String(isOpen)} @click=${() => { this._expandedCam = isOpen ? null : idx; }}>
                <ha-icon icon="mdi:cctv"></ha-icon><span class="cam-entry-title">${label}</span>
                <ha-icon icon=${isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
              </button>
              <button type="button" class="stream-del" aria-label=${`${label} entfernen`} @click=${() => {
                this._cameraEntries = this._cameraEntries.filter((_, i) => i !== idx);
                if (this._expandedCam === idx) this._expandedCam = null;
                else if (this._expandedCam > idx) this._expandedCam--;
                this._applyCameraEntries();
              }}><ha-icon icon="mdi:close"></ha-icon></button>
            </div>
            ${isOpen ? html`
              <div class="cam-entry-body">
                ${editorInput("Frigate Kamera-ID", entry.id, (value, input) => {
                  const id = value.trim().toLowerCase();
                  if (id && entries.some((other, i) => i !== idx && other.id === id)) {
                    input.value = entry.id;
                    input.setCustomValidity("Diese Kamera ist bereits ausgewählt.");
                    input.reportValidity();
                    input.setCustomValidity("");
                    return;
                  }
                  this._updateCamera(idx, { id });
                }, { placeholder: "z.B. einfahrt" })}
                ${editorInput("Anzeigename", entry.displayName, (value) => this._updateCamera(idx, { displayName: value.trim() }), { placeholder: "z.B. Einfahrt" })}
                ${this._renderCameraStreams(entry, idx)}
                ${editorSwitch("Ultra-Wide (Multiview-Kachel über alle Spalten)", entry.ultraWide === true, (checked) => this._updateCamera(idx, { ultraWide: checked }))}
                <p class="hint">Standard: deaktiviert. Eine Ultra-Wide-Kachel belegt in der Multiview-Ansicht alle vorhandenen Grid-Spalten der Card (nicht die gesamte Dashboard-Breite).</p>
                ${editorSwitch("Doorbell (Türklingel)", doorbell.enabled, enabled => changeDoorbell({ enabled }))}
                ${doorbell.enabled ? html`
                  ${editorInput("Klingel-Entität (Home Assistant)", doorbell.entity, entity => changeDoorbell({ entity }), { placeholder: "binary_sensor.tuerklingel" })}
                  ${editorInput("Von-Zustand", doorbell.from, from => changeDoorbell({ from }))}
                  ${editorInput("Zielzustand", doorbell.to, to => changeDoorbell({ to }))}
                  <p class="hint">Klingelt nur bei genau diesem Zustandswechsel im offenen Livebild. Interne HA-Zustände verwenden, z. B. off → on.</p>
                ` : ""}
              </div>
            ` : ""}
          </div>
        `;
      })}

      <button type="button" class="add-btn" @click=${() => this._addCamera()}>
        <ha-icon icon="mdi:plus"></ha-icon> Kamera-ID manuell eingeben
      </button>
    `;
  }

  _renderDisplay() {
    const cfg = this._config;
    const layout = cfg.layout ?? "auto";
    const multiviewActive = cfg.multiview === true;
    const viewMode = multiviewActive && cfg.view_mode === "timeline" ? "events" : (cfg.view_mode ?? "events");
    return html`
      <div class="select-row">
        <label for="view-mode">Ansicht</label>
        <select id="view-mode" .value=${viewMode} @change=${(e) => this._set("view_mode", e.target.value)}>
          <option value="events" ?selected=${viewMode === "events"}>Events (Liste)</option>
          <option value="timeline" ?disabled=${multiviewActive} ?selected=${viewMode === "timeline"}>Timeline (Aufnahme)</option>
          <option value="doorbell" ?selected=${viewMode === "doorbell"}>Doorbell (eine Kamera)</option>
        </select>
      </div>
      ${viewMode === "doorbell" ? html`<p class="hint">Die Doorbell-Kamera unter „Kameras“ auswählen. Multiview und Ereignisansicht werden hier nicht verwendet.</p>` : ""}
      ${multiviewActive && viewMode !== "doorbell"
        ? html`<p class="hint">Timeline-Modus ist deaktiviert, solange Multiview aktiv ist (siehe Tab „Livestream").</p>`
        : ""}

      ${viewMode === "timeline" && !multiviewActive ? html`
        ${editorInput("Timeline-Fenster (Stunden, 1–168)", cfg.timeline_window_hours ?? 24,
          (v) => this._set("timeline_window_hours", Math.max(1, Math.min(168, Number(v) || 24))), { type: "number", min: "1", max: "168" })}
        <p class="hint">Zeitraum der Frigate-Aufnahme, der in der Timeline angezeigt wird (rückwirkend ab jetzt).</p>
        ${editorSwitch("Timeline gespiegelt (Liste links, Achse rechts)", cfg.timeline_flipped === true, (v) => this._set("timeline_flipped", v))}
      ` : ""}

      <div class="select-row">
        <label>Layout</label>
        <select
          .value=${layout}
          @change=${(e) => this._set("layout", e.target.value)}
        >
          <option value="auto" ?selected=${layout === "auto"}>Auto</option>
          <option value="stacked" ?selected=${layout === "stacked"}>Stacked</option>
          <option value="split" ?selected=${layout === "split"}>Split</option>
        </select>
      </div>

      ${editorInput("Desktop Breakpoint (px)", cfg.desktop_breakpoint ?? 800, (v) => this._set("desktop_breakpoint", Number(v) || 800), { type: "number" })}
      ${editorSwitch("Section Mode (füllt Section-Zelle zu 100%)", cfg.section_mode === true, (v) => this._set("section_mode", v))}

      ${cfg.section_mode
        ? html`<p class="hint">Höhe/Breite werden im Section Mode ignoriert — die Card füllt ihre Grid-Zelle.</p>`
        : html`
            ${editorInput("Höhe (Fallback)", cfg.height ?? cfg.max_height ?? "auto", (v) => this._set("height", v || "auto"), { placeholder: "auto" })}
            ${editorInput("Mobile Höhe (< Desktop Breakpoint)", cfg.mobile_height, (v) => this._set("mobile_height", v), { placeholder: "leer = Fallback" })}
            ${editorInput("Desktop Höhe (≥ Desktop Breakpoint)", cfg.desktop_height, (v) => this._set("desktop_height", v), { placeholder: "leer = Fallback" })}
            ${editorInput("Breite", cfg.width ?? cfg.card_width ?? "auto", (v) => this._set("width", v || "auto"), { placeholder: "auto" })}
          `}
    `;
  }

  _renderFilters() {
    const cfg = this._config;
    const lang = cfg.language ?? "auto";
    return html`
      <div class="field">
        ${editorSwitch("Ereignisfilter anzeigen", cfg.show_filters !== false, (v) => this._set("show_filters", v), "filter-help")}
        <p class="hint" id="filter-help">Blendet die Filterleiste für Kamera, Objekt und Zeitraum ein oder aus. Aufnahmen werden dadurch nicht verändert.</p>
      </div>
      <div class="select-row">
        <label for="card-language">Sprache der Karte</label>
        <select id="card-language"
          .value=${lang}
          @change=${(e) => this._set("language", e.target.value)}
        >
          <option value="auto" ?selected=${lang === "auto"}>Auto</option>
          <option value="de" ?selected=${lang === "de"}>Deutsch</option>
          <option value="en" ?selected=${lang === "en"}>English</option>
        </select>
      </div>
    `;
  }

  _renderLabels() {
    const cfg = this._config;
    const colors = cfg.label_colors || {};
    const icons = cfg.label_icons || {};
    const style = cfg.label_style ?? "soft";
    const lang = this._lang;

    return html`
      <div class="select-row">
        <label>Label Stil</label>
        <select
          .value=${style}
          @change=${(e) => this._set("label_style", e.target.value)}
        >
          <option value="soft" ?selected=${style === "soft"}>Soft</option>
          <option value="solid" ?selected=${style === "solid"}>Solid</option>
          <option value="outline" ?selected=${style === "outline"}>Outline</option>
        </select>
      </div>

      <p class="hint">Label-Farben und -Icons (leer lassen für Standard):</p>

      ${EDITOR_LABELS.map((lbl) => {
        const displayName = translateLabel(lbl, lang);
        const colorVal = colors[lbl] || "";
        return html`
          <div class="label-row">
            <span class="label-name">${displayName}</span>
            <input
              type="color"
              .value=${colorVal || "#03a9f4"}
              title="Farbe für ${displayName}"
              @input=${(e) => {
                const newColors = { ...colors, [lbl]: e.target.value };
                this._set("label_colors", newColors);
              }}
            />
            <input type="text" class="label-color-field" aria-label=${`Farbcode für ${displayName}`}
              .value=${colorVal} placeholder="#03a9f4" @change=${(e) => this._setLabelValue("label_colors", lbl, e.target.value)} />
            <input type="text" class="label-icon-field" aria-label=${`Icon für ${displayName}`}
              .value=${icons[lbl] || ""} placeholder="mdi:..." @change=${(e) => this._setLabelValue("label_icons", lbl, e.target.value)} />
          </div>
        `;
      })}

      ${editorInput("Standard-Farbe (default)", colors.default, (v) => this._setLabelValue("label_colors", "default", v), { placeholder: "#03a9f4" })}
    `;
  }

  _setLabelValue(key, label, value) {
    const values = { ...this._config[key] };
    if (value.trim()) values[label] = value.trim();
    else delete values[label];
    this._set(key, Object.keys(values).length ? values : undefined);
  }

  _renderLivestream() {
    const cfg = this._config;
    const provider = cfg.live_provider || "auto";
    const modes = cfg.go2rtc_modes || "webrtc,mse,mjpeg";
    return html`
      <div class="field">
        <label>Live Provider</label>
        <select @change=${(e) => this._set("live_provider", e.target.value)}>
          ${["auto", "go2rtc", "mjpeg", "off"].map((v) => html`
            <option value=${v} ?selected=${provider === v}>${v}</option>
          `)}
        </select>
      </div>
      ${editorInput("Frigate URL (optional)", cfg.frigate_url, (v) => this._set("frigate_url", v), { placeholder: "Leer = Home-Assistant-Proxy" })}
      ${editorInput("go2rtc URL intern", cfg.go2rtc_url, (v) => this._set("go2rtc_url", v), { placeholder: "(LAN)" })}
      ${editorInput("go2rtc URL extern", cfg.go2rtc_url_external, (v) => this._set("go2rtc_url_external", v), { placeholder: "(extern via Reverse Proxy)" })}
      ${editorInput("go2rtc Modes (z.B. webrtc,mse,mjpeg)", modes, (v) => this._set("go2rtc_modes", v))}
      ${editorInput("Standard-Live-Kamera (leer = erste verfügbare)", cfg.live_camera, (v) => this._set("live_camera", v), { placeholder: "(auto)" })}
      ${editorSwitch("Live-Button anzeigen", cfg.show_live_button !== false, (v) => this._set("show_live_button", v))}
      ${editorSwitch("Auto-Start Livestream beim Öffnen", cfg.live_autostart !== false, (v) => this._set("live_autostart", v))}
      <div class="field">
        <label for="talk-mode">Sprechtaste</label>
        <select id="talk-mode" @change=${(e) => this._set("talk_mode", e.target.value)}>
          <option value="toggle" ?selected=${cfg.talk_mode !== "hold"}>Antippen zum Starten und Beenden (Standard)</option>
          <option value="hold" ?selected=${cfg.talk_mode === "hold"}>Zum Sprechen gedrückt halten</option>
        </select>
      </div>
      ${editorSwitch("Live-Controls Overlay anzeigen", cfg.live_controls !== false, (v) => this._set("live_controls", v))}
      <div class="field">
        <label>Live-Controls Position</label>
        <select @change=${(e) => this._set("live_controls_position", e.target.value)}>
          ${["bottom", "top"].map((v) => html`
            <option value=${v} ?selected=${(cfg.live_controls_position || "bottom") === v}>${v}</option>
          `)}
        </select>
      </div>

      ${editorSwitch("HD/SD-Button anzeigen", cfg.hd_sd_button !== false, (v) => this._set("hd_sd_button", v))}
      <div class="field">
        <label>HD/SD-Button Position</label>
        <select @change=${(e) => this._set("hd_sd_button_position", e.target.value)}>
          ${["top", "bottom"].map((v) => html`
            <option value=${v} ?selected=${(cfg.hd_sd_button_position || "top") === v}>${v}</option>
          `)}
        </select>
      </div>

      ${editorSwitch("Multiview (alle Kameras gleichzeitig live)", cfg.multiview === true, (v) => this._set("multiview", v))}

      ${cfg.multiview ? html`
        <div class="field">
          <label>Multiview Layout</label>
          <select @change=${(e) => this._set("multiview_layout", e.target.value)}>
            ${["auto", "split", "stacked"].map((v) => html`
              <option value=${v} ?selected=${(cfg.multiview_layout || "auto") === v}>${v}</option>
            `)}
          </select>
        </div>
        <div class="row">
          ${[ ["multiview_columns_mobile", "Mobile Spalten (1–4)"], ["multiview_columns_desktop", "Desktop Spalten (1–4)"] ].map(([key, label]) =>
            editorInput(label, cfg[key] ?? 1, (v) => this._set(key, v === "" ? null : FrigateVisionCard._normalizeColumnCount(v, 1)), { type: "number", min: "1", max: "4" }))}
        </div>
      ` : ""}
    `;
  }

  _renderAdvanced() {
    const cfg = this._config;
    return html`
      <div class="field">
        ${editorInput("Gruppierungszeitraum (Sekunden)", normalizeDedupeWindow(cfg.dedupe_window_seconds), (v, input) => {
          const seconds = normalizeDedupeWindow(v);
          input.value = String(seconds);
          this._set("dedupe_window_seconds", seconds);
        }, { type: "number", min: "0", step: "any", hint: "group-help" })}
        <p class="hint" id="group-help">Fasst Ereignisse derselben Kamera mit demselben Objektlabel zusammen. Standard: 30 Sekunden. 0 schaltet die Zeitgruppierung aus.</p>
      </div>
      <div class="field">
        ${editorInput("Aktualisierungsintervall (Sekunden)", cfg.auto_refresh_seconds ?? 0, (v, input) => {
          const seconds = Math.max(0, Number(v) || 0);
          input.value = String(seconds);
          this._set("auto_refresh_seconds", seconds);
        }, { type: "number", min: "0", step: "any", hint: "refresh-help" })}
        <p class="hint" id="refresh-help">Lädt Ereignisse und Reviews nur bei sichtbarem Tab erneut. 0 bedeutet keine automatische Aktualisierung (Standard).</p>
      </div>
    `;
  }

  static get styles() {
    return css`
      .editor {
        padding: 0;
      }
      .section {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        margin-bottom: 8px;
        overflow: hidden;
      }
      .section-header {
        width: 100%;
        border: 0;
        font: inherit;
        color: var(--primary-text-color);
        text-align: start;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        cursor: pointer;
        font-weight: 500;
        background: var(--secondary-background-color, #f5f5f5);
        user-select: none;
      }
      .section-header:hover {
        background: var(--divider-color, #e8e8e8);
      }
      .section-header .chevron {
        margin-left: auto;
        --mdc-icon-size: 20px;
      }
      .section-header ha-icon:first-child {
        --mdc-icon-size: 20px;
        color: var(--primary-color);
      }
      .section-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .field > span, .field > label {
        font-size: 0.9em;
        color: var(--primary-text-color);
      }
      .editor-switch { display: flex; align-items: center; gap: 10px; min-height: 32px; cursor: pointer; }
      .editor-switch input {
        appearance: none;
        flex: none;
        width: 36px;
        height: 22px;
        margin: 0;
        border: 1px solid var(--secondary-text-color, #666);
        border-radius: 12px;
        background: var(--secondary-background-color, #eee);
        color: var(--secondary-text-color, #666);
        cursor: pointer;
        display: grid;
        align-items: center;
        padding-inline: 3px;
      }
      .editor-switch input::before { content: ""; width: 14px; height: 14px; border-radius: 50%; background: currentColor; }
      .editor-switch input:checked { background: var(--primary-color, #0288d1); color: var(--text-primary-color, white); }
      .editor-switch input:checked::before { justify-self: end; }
      @media (forced-colors: active) { .editor-switch input { appearance: auto; } .editor-switch input::before { content: none; } }
      .field select, .editor-input input, .label-row input[type="text"] {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        font-family: inherit;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--divider-color, #ccc);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-size: 1em;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .row > * {
        flex: 1;
        min-width: 0;
      }
      .select-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .select-row label {
        min-width: 80px;
        font-size: 0.9em;
        color: var(--primary-text-color);
      }
      .select-row select {
        flex: 1;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, #ccc);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-size: 0.95em;
        font-family: inherit;
        outline: none;
        cursor: pointer;
        appearance: auto;
      }
      .select-row select:focus {
        border-color: var(--primary-color);
      }
      .hint {
        font-size: 0.82em;
        color: var(--secondary-text-color);
        margin: 4px 0 0 0;
      }
      .label-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .label-name {
        min-width: 90px;
        font-size: 0.88em;
        font-weight: 500;
      }
      .label-row input[type="color"] {
        width: 32px;
        height: 32px;
        min-width: 32px;
        padding: 0;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 6px;
        cursor: pointer;
        background: none;
      }
      .label-color-field {
        width: 90px;
        min-width: 90px;
        flex: 0 0 90px;
        --mdc-text-field-height: 36px;
      }
      .label-icon-field {
        flex: 1;
        --mdc-text-field-height: 36px;
      }
      .stream-del {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--error-color, #c62828);
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        --mdc-icon-size: 18px;
      }
      .stream-del:hover {
        background: color-mix(in srgb, var(--error-color, #c62828) 12%, transparent);
      }
      .stream-actions { display: flex; flex-wrap: wrap; gap: 6px; }
      .add-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: 1px dashed var(--divider-color, #ccc);
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        color: var(--primary-color);
        font-size: 0.88em;
        font-family: inherit;
        --mdc-icon-size: 18px;
      }
      .add-btn:hover {
        background: color-mix(in srgb, var(--primary-color) 8%, transparent);
      }
      .cam-entry {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 6px;
        margin-bottom: 6px;
        overflow: hidden;
      }
      .cam-entry-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        background: var(--secondary-background-color, #f5f5f5);
        user-select: none;
      }
      .cam-entry-header:hover {
        background: var(--divider-color, #e8e8e8);
      }
      .cam-entry-title {
        flex: 1;
        font-size: 0.9em;
        font-weight: 500;
      }
      .cam-toggle {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
        text-align: start;
        overflow-wrap: anywhere;
        --mdc-icon-size: 18px;
      }
      .cam-entry-body {
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    `;
  }
}

const customReplyId = id => typeof id === "string" && /^[0-9a-f]{32}$/.test(id);

async function doorbellReplyRequest(hass, stream, replyId) {
  const camera = frigateCameraGroups(hass).get(stream?.client)?.get(stream?.camera?.toLowerCase());
  if (!camera || camera.ambiguous || stream.redirected || !hass?.callWS || hass.connected === false) {
    if (replyId) throw new Error("Doorbell reply unavailable");
    return { replies: null };
  }
  return hass.callWS({
    type: "frigate_vision/doorbell_replies", entity_id: camera.entityId, instance_id: stream.client,
    ...(replyId ? { reply_id: replyId } : {}),
  });
}

// A manual alias can belong to a different camera, and the same alias can
// exist on different NVRs. Never infer a physical control target from it.
async function streamMatchesCamera(hass, stream) {
  const camera = frigateCameraGroups(hass).get(stream.client)?.get(stream.camera?.toLowerCase());
  if (!camera || camera.ambiguous || stream.redirected) return false;
  if (stream.directBase) {
    const message = { type: "frigate_vision/profile" };
    if (stream.entry) message.entry_id = stream.entry;
    const { profile } = await hass.callWS(message);
    if (!profile || profile.frigate_client_id !== stream.client || go2rtcBase(profile) !== stream.directBase) return false;
  } else if (stream.name === camera.cameraName) {
    return true; // Canonical name on the instance-specific HA proxy.
  }
  const result = await hass.callWS({
    type: "frigate_vision/camera_streams", entity_id: camera.entityId, instance_id: stream.client,
  });
  return Array.isArray(result?.streams) && result.streams.includes(stream.name);
}

function renderCameraControls(hass, config, instanceId, cameraId, live, talkState, t, doorbell) {
  if (config.live_controls === false || config.live_provider === "off") return "";
  return html`${usableDoorbell(doorbell) ? "" : talkButton(live, config, talkState, t)}${renderPtzControls(hass, instanceId, cameraId, live?.playbackTarget, t)}`;
}

function hasDoorbellOverlay(config, doorbell) {
  return usableDoorbell(doorbell) && config.live_controls !== false && config.live_provider !== "off";
}

function canFullscreenPlayer() {
  return document.fullscreenEnabled && typeof Element.prototype.requestFullscreen === "function";
}

function containingDialog(element) {
  for (let node = element; node; node = node.getRootNode().host) {
    const dialog = node.closest("dialog");
    if (dialog) return dialog;
  }
  return null;
}

function renderDoorbell(hass, config, cameraId, live, talkState, talkMuted, talkAudioBlocked, t, doorbell, embedded = false, cameraAudio = null) {
  if (!hasDoorbellOverlay(config, doorbell)) return "";
  return html`<frigate-vision-doorbell .hass=${hass} .cameraId=${cameraId} .instanceId=${config.frigate_client_id} .controller=${live}
    .settings=${doorbell} .talkState=${talkState} .talkMuted=${talkMuted} .talkAudioBlocked=${talkAudioBlocked} .t=${t} .embedded=${embedded}
    .cameraAudio=${cameraAudio} .ringOnMount=${embedded && config.doorbell_ring_on_mount === true}></frigate-vision-doorbell>`;
}

class FrigateVisionDoorbell extends LitElement {
  static properties = {
    hass: { attribute: false }, cameraId: {}, instanceId: { attribute: false }, controller: { attribute: false },
    settings: { attribute: false }, talkState: {}, talkMuted: { attribute: false }, talkAudioBlocked: { attribute: false }, t: { attribute: false },
    embedded: { attribute: false }, ringOnMount: { attribute: false }, cameraAudio: { attribute: false },
    _incoming: { state: true }, _menu: { state: true }, _reply: { state: true },
    _failed: { state: true }, _triedAnswer: { state: true }, _fullscreen: { state: true },
    _choices: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this._lifetime = new AbortController();
    this._mountChecked = false;
    const options = { signal: this._lifetime.signal };
    window.addEventListener("pagehide", () => this._dismiss(), options);
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._dismiss(); }, options);
    document.addEventListener("fullscreenchange", () => {
      this._fullscreen = this._ownFullscreen();
      if (this._menu) this._positionMenu();
    }, options);
    const leaveFullscreen = event => {
      if (!this._ownFullscreen()) return;
      // Some browsers deliver Escape to the modal's close watcher before
      // leaving fullscreen. Exit the camera surface, not the dialog/call.
      event.preventDefault();
      event.stopPropagation();
      this._exitFullscreen();
    };
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") leaveFullscreen(event);
    }, { ...options, capture: true });
    const dialog = containingDialog(this);
    dialog?.addEventListener("cancel", leaveFullscreen, options);
    dialog?.addEventListener("close", () => {
      if (!dialog.open) {
        this._dismiss();
        if (this._ownFullscreen()) this._exitFullscreen();
      }
    }, options);
    const moveMenu = () => { if (this._menu) this._positionMenu(); };
    window.addEventListener("resize", moveMenu, options);
    window.addEventListener("scroll", moveMenu, { ...options, capture: true });
    this.requestUpdate();
  }

  disconnectedCallback() {
    this._lifetime.abort();
    this._surfaceObserver?.disconnect();
    this._surfaceObserver = null;
    this._unsubscribe();
    super.disconnectedCallback();
  }

  updated(changed) {
    if (this.embedded && !this._surfaceObserver && this.isConnected && window.IntersectionObserver) {
      this._surfaceVisible = false;
      const observer = this._surfaceObserver = new IntersectionObserver(([entry]) => {
        if (this._surfaceObserver !== observer) return;
        this._surfaceVisible = entry.isIntersecting;
        if (!this._surfaceVisible) this._dismiss();
        else if (this._surfaceVisible) this._maybeRingOnMount();
      });
      // A dialog or container can be closed/hidden without removing the card.
      observer.observe(this.parentElement);
    }
    if (changed.has("_menu") && this._menu) {
      const menu = this._positionMenu();
      menu?.showPopover?.();
    }
    if (this._menu && changed.has("_choices") && this._focusReplyMenu) this.renderRoot.querySelector(".replies button")?.focus();
    if (this._incoming && changed.get("talkState") === "sending" && this.talkState !== "sending") this._armExpiry();
    const connection = this.hass?.connection;
    const { entity, from, to } = this.settings || {};
    const key = this._callKey();
    if (this.isConnected && connection?.subscribeEvents && this.hass.connected !== false) {
      if (this._subscription?.connection === connection && this._subscription.key === key &&
          this._subscription.controller === this.controller) { this._maybeRingOnMount(); return; }
      this._unsubscribe();
      let calls = doorbellCalls.get(connection);
      if (!calls) doorbellCalls.set(connection, calls = new Map());
      const sub = this._subscription = { connection, calls, key, controller: this.controller };
      // Home Assistant automatically resubscribes on reconnect. The server sends
      // only new state_changed events, unlike frontend state snapshots/baselines.
      sub.offline = () => { sub.disconnected = this._mountChecked = true; this._dismiss(sub.controller); };
      sub.online = () => { sub.disconnected = false; };
      connection.addEventListener?.("disconnected", sub.offline);
      connection.addEventListener?.("ready", sub.online);
      connection.subscribeEvents((event) => {
        if (this._subscription !== sub || sub.disconnected || !this.isConnected || this.hass?.connected === false ||
            this.controller !== sub.controller || (sub.controller?.cameraId && sub.controller.cameraId !== this.cameraId) ||
            this._callKey() !== sub.key || document.hidden) return;
        const data = event?.data;
        if (data?.entity_id === entity && data.old_state?.state === from && data.new_state?.state === to && this._surfaceVisible !== false) {
          this._mountChecked = true;
          this._receiveRing(data.new_state.last_changed);
        }
      }, "state_changed").then((unsub) => {
        if (this._subscription === sub) {
          sub.unsubscribe = unsub;
          this._maybeRingOnMount();
        } else unsub().catch(() => {});
      }).catch(() => {
        if (this._subscription === sub) this._unsubscribe();
      });
    } else if (this._subscription && (this.hass?.connected !== false || this._subscription.connection !== connection)) {
      this._unsubscribe();
    } else if (this.hass?.connected === false) {
      if (this._subscription) this._mountChecked = true;
      this._dismiss();
    }
  }

  _callKey() {
    const { entity, from, to } = this.settings || {};
    return JSON.stringify([this.instanceId, this.cameraId, entity, from, to]);
  }

  _resumeMutedCall(record) {
    if (this._incoming || !record?.muted || record.attached || record.closed) return;
    const remaining = record.expiresAt - Date.now();
    if (remaining > 0) this._ring(record, remaining);
  }

  _receiveRing(stamp, onMount = false) {
    const time = Date.parse(stamp);
    if (!Number.isFinite(time)) {
      // Only subscribed edges can trigger a call without a comparable identity.
      if (!onMount && !this._incoming) this._ring();
      return;
    }
    const { calls, key } = this._subscription;
    const previous = calls.get(key);
    // HA frontend snapshots can be rounded to milliseconds. Alias a matching
    // snapshot to the edge, but keep two fully identified live edges distinct.
    if (previous && (previous.stamp === stamp || (previous.onMount || onMount) && previous.time === time)) {
      if (!onMount && previous.onMount) Object.assign(previous, { stamp, onMount: false });
      this._resumeMutedCall(previous);
      return;
    }
    const age = Date.now() - time;
    if (age < -DOORBELL_CLOCK_SKEW_MS || age >= DOORBELL_RING_MS) return;
    // Keep the exact HA timestamp, including fractions finer than a millisecond.
    if (previous && (time < previous.time || (time === previous.time && stamp < previous.stamp))) return;
    // A new press can replace a silenced unanswered call, but not take over a conversation.
    if (this._incoming && (!this._incoming.muted || this.controller?.talkRequested)) return;
    if (previous?.attached && this._incoming?.record !== previous) return;
    if (this._incoming) this._dismiss(this.controller, { keepCameraAudio: true });
    clearTimeout(previous?.cleanup);
    const record = { stamp, time, onMount, muted: false, attached: false, closed: false };
    calls.set(key, record);
    this._ring(record, DOORBELL_RING_MS - Math.max(0, age));
  }

  _maybeRingOnMount() {
    const sub = this._subscription;
    if (this._mountChecked || !sub?.unsubscribe || sub.disconnected || this._surfaceVisible === false ||
        document.hidden || this.hass.connected === false) return;
    const state = this.hass.states?.[this.settings.entity];
    if (this.ringOnMount && state && state.state === this.settings.to) this._receiveRing(state.last_changed, true);
    // A momentary sensor may already have reset; the known muted call can
    // still be answered. This never starts a new ringtone from a baseline.
    this._resumeMutedCall(sub.calls.get(sub.key));
    if (state || this._incoming) this._mountChecked = true;
  }

  _ownFullscreen() {
    const player = this.parentElement;
    const fullscreen = player?.getRootNode().fullscreenElement;
    return Boolean(fullscreen && player.contains(fullscreen));
  }

  _exitFullscreen() {
    document.exitFullscreen?.().catch(() => {});
  }

  _toggleFullscreen() {
    if (this._ownFullscreen()) this._exitFullscreen();
    // Fullscreen the wrapper containing both the existing video and overlay.
    // Never move or recreate the video or any call controls.
    else this.parentElement?.requestFullscreen?.().catch(() => {});
  }

  _positionMenu() {
    const menu = this.renderRoot?.querySelector(".replies");
    const button = this.renderRoot?.querySelector(".more");
    if (!menu?.showPopover || !button) return null;
    const { right, top } = button.getBoundingClientRect();
    menu.style.setProperty("--right", `${Math.max(8, window.innerWidth - right)}px`);
    menu.style.setProperty("--bottom", `${window.innerHeight - top + 6}px`);
    menu.style.setProperty("--height", `${Math.max(40, top - 14)}px`);
    return menu;
  }

  _unsubscribe() {
    const sub = this._subscription;
    this._subscription = null;
    sub?.connection.removeEventListener?.("disconnected", sub.offline);
    sub?.connection.removeEventListener?.("ready", sub.online);
    sub?.unsubscribe?.().catch(() => {});
    this._dismiss(sub?.controller, { preserveMuted: true });
  }

  _ring(record = null, duration = DOORBELL_RING_MS) {
    this._incoming = { record, muted: !!record?.muted };
    if (record) record.attached = true;
    this._armExpiry(duration);
    if (this._incoming.muted) return;
    try {
      const audio = this._ringAudio = new Audio(doorbellAudioUrl("ring"));
      audio.loop = true;
      audio.play().catch(() => {}); // Autoplay denial must not affect the visible call.
    } catch {}
  }

  _armExpiry(duration = DOORBELL_RING_MS) {
    clearTimeout(this._expires);
    this._expires = setTimeout(() => this._dismiss(), duration);
    const record = this._incoming?.record;
    const { calls, key } = this._subscription || {};
    if (record && calls?.get(key) === record) {
      record.expiresAt = Date.now() + duration;
      retainDoorbellCall(calls, key, record);
    }
  }

  _silence() {
    this._ringAudio?.pause();
    this._ringAudio = null;
  }

  _dismiss(controller = this.controller, { preserveMuted = false, keepCameraAudio = false } = {}) {
    clearTimeout(this._expires);
    this._expires = null;
    this._silence();
    const record = this._incoming?.record;
    if (record) {
      record.attached = false;
      record.closed = !preserveMuted || !record.muted || this._triedAnswer;
      if (!record.closed) this._mountChecked = false;
    }
    this._incoming = this._menu = this._failed = this._triedAnswer = false;
    this._reply = this._choiceRequest = null;
    if (controller?.talkRequested || this.embedded) controller?.stopTalk();
    if (this.embedded && !keepCameraAudio) {
      controller?.muteCameraAudio({ resume: this.isConnected && this._surfaceVisible !== false && !document.hidden });
    }
    controller?.stopAnnouncement();
  }

  _acceptIncoming() {
    // A single-camera call can adopt an idle mic, but cannot re-answer.
    if (!this._incoming || (this.controller?.talkRequested && (!this.embedded || this._triedAnswer))) return;
    if (this._reply) {
      this._reply = null; // Invalidate completion before cancelling the media attempt.
      this.controller?.stopAnnouncement();
    }
    return this._answer();
  }

  async _answer() {
    if (!this._incoming || this._reply || (this.controller?.talkRequested && (!this.embedded || this._triedAnswer))) return;
    this._focusDismiss();
    this._silence();
    this._menu = this._failed = false;
    this._triedAnswer = true;
    const call = this._incoming;
    const controller = this.controller;
    this._armExpiry();
    await controller?.startTalk({ verifyTarget: true, listen: true });
    if (this._incoming === call && this.controller === controller && controller?.talkRequested) clearTimeout(this._expires);
  }

  _focusDismiss() {
    // Answer and reply controls disappear while busy. Keep keyboard focus on
    // the persistent exit button instead of dropping it onto the document.
    this.renderRoot.querySelector(".dismiss")?.focus({ preventScroll: true });
  }

  async _toggleReplies(event) {
    this._menu = !this._menu;
    if (!this._menu) return;
    this._focusReplyMenu = event.detail === 0;
    this._choices = null;
    const call = this._incoming, target = this.controller?.playbackTarget;
    const request = this._choiceRequest = {};
    let choices;
    try {
      const result = await doorbellReplyRequest(this.hass, target);
      choices = Array.isArray(result?.replies) ? result.replies.slice(0, 3).filter(
        item => customReplyId(item?.id) && typeof item.text === "string" && item.text.trim()
      ) : Object.entries(DOORBELL_REPLIES).map(([id, text]) => ({ id, text, bundled: true }));
    } catch (err) {
      // A stale/pre-upgrade backend has no command; built-in assets still work.
      if (err?.code === "unknown_command") choices = Object.entries(DOORBELL_REPLIES).map(([id, text]) => ({ id, text, bundled: true }));
      else choices = [];
    }
    if (this._choiceRequest === request && this._incoming === call && this.controller?.playbackTarget === target) {
      this._choices = choices;
      this.updateComplete.then(() => { if (this._menu) this._positionMenu(); });
    }
  }

  async _playReply(reply) {
    if (!this._incoming || this._reply || this.controller?.talkRequested) return;
    this._focusDismiss();
    this._incoming.muted = true;
    if (this._incoming.record) this._incoming.record.muted = true;
    this._silence();
    this._menu = this._failed = false;
    const request = this._reply = {};
    this._armExpiry(DOORBELL_REPLY_TIMEOUT_MS);
    let sent = false;
    try { sent = await this.controller?.playDoorbellReply(reply); } catch {}
    if (this._reply !== request) return;
    this._reply = null;
    this._failed = !sent;
    this._armExpiry();
  }

  _toggleIdleTalk() {
    if (this.controller?.talkRequested) this.controller.stopTalk();
    else if (!this._incoming && !document.hidden && this._surfaceVisible !== false) {
      this.controller?.startTalk({ verifyTarget: true });
    }
  }

  _toggleCameraAudio() {
    if (this.cameraAudio === "on") this.controller?.muteCameraAudio({ resume: true });
    else if (!document.hidden && this._surfaceVisible !== false) this.controller?.enableCameraAudio();
  }

  _renderIndependentAudio(d, talk, manualTalk) {
    if (!this.embedded) return "";
    const a = this.t?.doorbellAudio || STRINGS.en.doorbellAudio;
    const listening = this.cameraAudio === "on";
    const showMic = !this._incoming || manualTalk;
    const micLabel = manualTalk ? talk.stop : a.start;
    return html`<div class="independent-audio">
      <div class="audio-buttons">
        ${showMic ? html`<button type="button" class="idle-mic" aria-label=${micLabel} title=${micLabel}
          aria-describedby=${talk[this.talkState] ? "idle-mic-status" : ""}
          @click=${this._toggleIdleTalk}>${doorbellMicIcon(this.talkState !== "sending")}</button>` : ""}
        ${this.cameraAudio != null ? html`<button type="button" class="speaker" aria-label=${a.speaker}
          aria-pressed=${String(listening)} title=${listening ? a.mute : d.listen}
          aria-describedby=${this.cameraAudio === "blocked" ? "speaker-status" : ""}
          @click=${this._toggleCameraAudio}>${doorbellSpeakerIcon(!listening)}</button>` : ""}
      </div>
      ${showMic && talk[this.talkState] ? html`<span id="idle-mic-status" class="status" role="status">${talk[this.talkState]}</span>` : ""}
      ${this.cameraAudio === "blocked" ? html`<span id="speaker-status" class="status" role="status">${d.listenBlocked}</span>` : ""}
    </div>`;
  }

  render() {
    const d = this.t?.doorbell || STRINGS.en.doorbell;
    const talk = this.t?.talk || STRINGS.en.talk;
    const manualTalk = this.embedded && !this._triedAnswer && (this.talkState === "pending" || this.talkState === "sending");
    const audio = this._renderIndependentAudio(d, talk, manualTalk);
    const fullscreenLabel = this._fullscreen ? d.exitFullscreen : d.fullscreen;
    const fullscreen = canFullscreenPlayer()
      ? html`<button type="button" class="fullscreen" aria-label=${fullscreenLabel} title=${fullscreenLabel}
          @click=${this._toggleFullscreen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d=${this._fullscreen ? "M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5" : "M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5"} />
          </svg></button>` : "";
    return html`${audio}${fullscreen}${this._renderCall(d, talk, manualTalk)}`;
  }

  _renderCall(d, talk, manualTalk) {
    if (!this._incoming) return "";
    const state = this._triedAnswer ? this.talkState : "idle";
    const sending = state === "sending", pending = state === "pending";
    const canAnswer = !pending && !sending;
    const waiting = !this._triedAnswer && !this._reply;
    const ringing = waiting && !this._incoming.muted;
    const exitLabel = waiting ? d.decline : sending || this._reply ? d.end : pending ? d.cancel : d.dismiss;
    const muted = sending && !!this.talkMuted;
    const incoming = this._incoming.muted ? d.silenced : d.incoming;
    const status = this._reply ? d.playing : this._failed ? d.failed : muted ? d.muted : talk[state] || incoming;
    return html`<div class="call" ?data-waiting=${waiting} ?data-ringing=${ringing} @keydown=${(e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (this._menu) {
        this._menu = false;
        this.renderRoot.querySelector(".more")?.focus();
      } else this._dismiss();
    }}>
      <span class="status" role="status">${status}</span>
      ${sending && this.talkAudioBlocked ? html`<span id="camera-audio-status" class="status" role="status">${d.listenBlocked}</span>
        <button type="button" class="listen" aria-describedby="camera-audio-status"
          @click=${() => { this._focusDismiss(); this.controller?.enableTalkAudio(); }}>${d.listen}</button>` : ""}
      <div class="buttons">
        <button type="button" class="dismiss" ?data-sending=${sending} aria-label=${exitLabel} @click=${() => this._dismiss()}>
          ${waiting || sending ? doorbellHandset() : exitLabel}
        </button>
        ${sending ? html`<button type="button" class="mic-toggle" aria-label=${d.mute}
          aria-pressed=${String(muted)} title=${muted ? d.unmute : d.mute}
          @click=${() => this.controller?.toggleTalkMute()}>${doorbellMicIcon(muted)}</button>` : ""}
        ${canAnswer && !this._reply ? html`
          <button type="button" class="more" title=${d.replies} aria-label=${d.replies} aria-expanded=${String(!!this._menu)} ?disabled=${manualTalk}
            aria-controls="replies" @click=${this._toggleReplies}>…</button>` : ""}
        ${canAnswer ? html`
          <button type="button" class="phone" aria-label=${d.answer} title=${d.answer} @click=${this._acceptIncoming}>
            ${doorbellHandset(true)}
          </button>` : ""}
        ${this._menu ? html`<div id="replies" class="replies" popover="auto" aria-label=${d.replies}
          @toggle=${(e) => { if (e.newState === "closed" && e.target.isConnected) this._menu = false; }}>
          ${this._choices === null ? html`<span class="reply-message" role="status">${d.loadingReplies}</span>` :
            this._choices?.length ? this._choices.map(({ id, text, bundled }) => html`<button lang=${bundled ? 'de' : ''} type="button" @click=${() => this._playReply(id)}>${text}</button>`) :
              html`<span class="reply-message" role="status">${d.repliesUnavailable}</span>`}
        </div>` : ""}
      </div>
    </div>`;
  }

  static styles = css`
    :host { --decline: #bd273b; --answer: #17683b; --neutral: #222b33; --ink: #fff; --edge: #10161c;
      position: absolute; inset: 0 8px; z-index: 5; pointer-events: none; container-type: inline-size; color: var(--ink); }
    .call { position: absolute; inset-inline: 0; bottom: clamp(6px, calc(100% - 80px), 48px);
      display: grid; justify-items: center; gap: 4px; font: 13px/1.3 system-ui, sans-serif; }
    .call[data-ringing] { bottom: clamp(6px, calc(100% - 62px), 48px); }
    .fullscreen { position: absolute; inset-inline-start: 0; top: 8px; pointer-events: auto;
      display: grid; place-items: center; border-radius: 50%; background: rgb(16 22 28 / .8); }
    .fullscreen svg { inline-size: 23px; block-size: 23px; }
    .independent-audio { position: absolute; inset: 8px 0 auto; display: grid; justify-items: end; gap: 4px;
      font: 13px/1.3 system-ui, sans-serif; }
    .audio-buttons { display: flex; gap: 5px; pointer-events: auto; }
    .audio-buttons button { display: grid; place-items: center; border-radius: 50%; background: rgb(16 22 28 / .8); }
    button:disabled { opacity: .55; cursor: default; }
    .status { max-width: min(20rem, 60vw); padding: 4px 8px; background: #121212eb; border-radius: 6px; }
    .buttons { position: relative; display: flex; align-items: center; gap: 5px; pointer-events: auto; }
    button { cursor: pointer; color: inherit; border: 0; border-radius: 8px; background: var(--neutral);
      min-height: 44px; min-width: 44px; font: inherit; touch-action: manipulation; }
    button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; box-shadow: 0 0 0 6px var(--edge); }
    button svg { display: block; inline-size: 24px; block-size: 24px; }
    .listen { max-width: 100%; padding-inline: 10px; pointer-events: auto; border: 1px solid var(--ink); }
    .more { font-size: 21px; line-height: 1; }
    .phone { display: grid; place-items: center; background: var(--answer); }
    .dismiss { display: inline-flex; align-items: center; gap: 4px; padding-inline: 10px;
      border: 1px solid rgb(255 255 255 / .7); font-weight: 600; }
    .dismiss[data-sending] { display: grid; place-items: center; padding: 0; inline-size: 52px; block-size: 52px;
      border-radius: 50%; background: var(--decline); }
    .mic-toggle { display: grid; place-items: center; padding: 0; border-radius: 50%;
      border: 1px solid rgb(255 255 255 / .48); }
    .mic-toggle[aria-pressed=true] { background: var(--ink); color: var(--neutral); }
    .call[data-ringing] .status { position: absolute; inline-size: 1px; block-size: 1px;
      padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .call[data-waiting] .buttons { gap: 9px; }
    .call[data-waiting] .buttons > button { display: grid; place-items: center; border: 1px solid rgb(255 255 255 / .48);
      border-radius: 50%; padding: 0; box-shadow: 0 2px 8px rgb(0 0 0 / .45); }
    .call[data-waiting] .buttons > button:focus-visible { box-shadow: 0 0 0 6px var(--edge); }
    .call[data-waiting] :is(.phone, .dismiss) { inline-size: 52px; block-size: 52px; }
    .call[data-waiting] .dismiss { margin-inline-end: 8px; background: var(--decline); }
    .call[data-waiting] .more { inline-size: 44px; block-size: 44px; }
    @container (max-width: 195px) {
      .call[data-waiting] .buttons { gap: 4px; }
      .call[data-waiting] :is(.phone, .dismiss) { inline-size: 44px; block-size: 44px; }
      .call[data-waiting] .dismiss { margin-inline-end: 0; }
    }
    .replies { position: absolute; inset: auto 0 calc(100% + 6px) auto; z-index: 1;
      width: max-content; max-width: min(16rem, 70vw); padding: 4px; color: var(--ink); background: var(--neutral);
      border: 1px solid rgb(255 255 255 / .35); border-radius: 8px; }
    .replies:popover-open { position: fixed; inset: auto var(--right) var(--bottom) auto; margin: 0;
      max-height: var(--height); overflow: auto; }
    .replies button { display: block; width: 100%; height: auto; min-height: 40px; text-align: start; padding: 6px 10px; background: transparent; }
    .replies button:hover, .replies button:focus-visible { background: #454545; }
  `;
}

function renderPtzControls(hass, instanceId, cameraId, stream, t) {
  if (!instanceId || !cameraId || stream?.client !== instanceId || stream.camera !== cameraId) return "";
  if (!hass?.services?.frigate?.ptz || !hass.callService || !hass.callWS || hass.connected === false) return "";
  const camera = frigateCameraGroups(hass).get(instanceId)?.get(cameraId.toLowerCase());
  if (!camera || camera.ambiguous || ["unavailable", "unknown", "off"].includes(hass.states[camera.entityId].state)) return "";
  return html`<frigate-vision-ptz .hass=${hass} .stream=${stream} .cameraName=${camera.cameraName}
    .entityId=${camera.entityId} .t=${t}></frigate-vision-ptz>`;
}

class FrigateVisionPtz extends LitElement {
  static properties = {
    hass: { attribute: false }, stream: { attribute: false }, cameraName: { attribute: false },
    entityId: { attribute: false }, t: { attribute: false }, _features: { state: true },
    _open: { state: true }, _pulse: { state: true }, _failed: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._reset();
  }

  _reset() {
    this._close();
    this._target = null;
    this._features = null;
    this._failed = false;
  }

  willUpdate(changed) {
    if (!this.isConnected) return;
    const connection = this.hass.connection || this.hass.callWS;
    if (this._target?.connection === connection && !changed.has("stream") && !changed.has("cameraName") && !changed.has("entityId")) return;
    this._reset();
    const target = { connection, entityId: this.entityId };
    this._target = target;
    this._loadFeatures(target);
  }

  async _loadFeatures(target) {
    try {
      if (!await streamMatchesCamera(this.hass, this.stream) || this._target !== target) return;
      const result = await this.hass.callWS({ type: "frigate/ptz/info", instance_id: this.stream.client, camera: this.cameraName });
      const info = typeof result === "string" ? JSON.parse(result) : result;
      if (this._target === target && Array.isArray(info?.features)) this._features = info.features;
    } catch {
      // Fixed cameras and older Frigate integrations may not return PTZ info.
    }
  }

  async _send(hass, target, action, argument) {
    try {
      await hass.callService("frigate", "ptz", argument ? { action, argument } : { action }, { entity_id: target.entityId });
    } catch {
      if (this._target === target) this._failed = true;
    }
  }

  _nudge(action, argument) {
    if (!this._open || this._pulse || !this._target) return;
    this._failed = false;
    // Frigate move/zoom are continuous. Schedule STOP independently of the
    // service acknowledgment and pin it to the original connection and entity.
    const stop = () => this._endPulse();
    this._pulse = { target: this._target, hass: this.hass, stop, timer: setTimeout(stop, 300) };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", stop);
    this._send(this.hass, this._target, action, argument);
  }

  async _endPulse() {
    const pulse = this._pulse;
    if (!pulse || pulse.stopping) return;
    pulse.stopping = true;
    clearTimeout(pulse.timer);
    window.removeEventListener("pagehide", pulse.stop);
    document.removeEventListener("visibilitychange", pulse.stop);
    await this._send(pulse.hass, pulse.target, "stop");
    if (this._pulse === pulse) this._pulse = null;
  }

  _close() {
    const panel = this.renderRoot?.querySelector("dialog");
    if (panel?.open) panel.close();
    else if (panel?.hidePopover && panel.matches(":popover-open")) panel.hidePopover();
    this._open = false;
    this._endPulse();
  }

  render() {
    const pt = this._features?.includes("pt"), zoom = this._features?.includes("zoom");
    if (!pt && !zoom) return html``;
    const t = this.t?.ptz ? this.t : STRINGS.en;
    const labels = t.ptz;
    const command = (action, arg, label, icon) => html`<button type="button" class=${arg} title=${label} aria-label=${label}
      ?disabled=${!!this._pulse} @click=${() => this._nudge(action, arg)}>${icon}</button>`;
    return html`
      <button type="button" class="trigger" popovertarget="controls" aria-controls="controls" aria-expanded=${String(!!this._open)}
        title=${labels.label} @click=${() => {
          const panel = this.renderRoot.querySelector("dialog");
          if (!panel.showPopover) { panel.showModal(); this._open = true; }
        }}>PTZ</button>
      <dialog id="controls" popover="auto" aria-label=${`${labels.label}: ${this.cameraName}`}
        @beforetoggle=${e => { this._open = e.newState === "open"; if (!this._open) this._endPulse(); }}
        @close=${() => { this._open = false; this._endPulse(); }}>
        <header><strong>${labels.label} · ${this.cameraName}</strong>
          <button type="button" aria-label=${t.close} title=${t.close} @click=${this._close}>×</button></header>
        <div class="pad">
          ${pt ? html`${command("move", "up", labels.up, "↑")}${command("move", "left", labels.left, "←")}
            ${command("move", "right", labels.right, "→")}${command("move", "down", labels.down, "↓")}` : ""}
          <button type="button" class="stop" aria-label=${labels.stop} title=${labels.stop} @click=${() => {
            if (!this._open) return;
            this._failed = false;
            if (this._pulse) this._endPulse(); else this._send(this.hass, this._target, "stop");
          }}>■</button>
          ${zoom ? html`${command("zoom", "out", t.timeline_zoom_out, "−")}${command("zoom", "in", t.timeline_zoom_in, "+")}` : ""}
        </div>
        ${this._failed ? html`<p role="alert">${labels.failed}</p>` : ""}
      </dialog>`;
  }

  static styles = css`
    :host { display: contents; }
    button { cursor: pointer; touch-action: manipulation; font: inherit; color: inherit; }
    .trigger { border: 0; border-radius: 6px; padding: 0 7px; height: 32px; color: white; background: rgb(0 0 0 / .65); font: bold 12px sans-serif; }
    dialog { max-width: min(18rem, 90vw); padding: 10px; border: 1px solid var(--divider-color, #888); border-radius: 10px; color: var(--primary-text-color, #222); background: var(--card-background-color, white); box-shadow: 0 3px 14px #0005; }
    @supports (position-area: bottom) {
      dialog:popover-open { inset: auto; position-area: bottom span-left; justify-self: end; margin: 4px 0; position-try-fallbacks: flip-block, flip-inline; }
    }
    header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-size: .85rem; overflow-wrap: anywhere; }
    dialog button { width: 44px; height: 44px; border: 1px solid var(--divider-color, #aaa); border-radius: 6px; background: transparent; font-size: 20px; }
    dialog button:disabled { opacity: .5; }
    .pad { display: grid; justify-content: center; grid-template-areas: ". up ." "left stop right" ". down ." "out . in"; gap: 2px; }
    .up { grid-area: up; } .down { grid-area: down; } .left { grid-area: left; } .right { grid-area: right; }
    .stop { grid-area: stop; } .in { grid-area: in; } .out { grid-area: out; }
    p { margin: 8px 0 0; font-size: .85rem; }
  `;
}

class FrigateVisionLiveTile extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      cameraId: { type: String },
      instanceId: { attribute: false },
      cameraEntry: { attribute: false },
      cardConfig: { attribute: false },
      t: { attribute: false },
      clipUrl: { attribute: false },
      clipError: { attribute: false },
      clipLoading: { attribute: false },
      clipSourceKind: { attribute: false },
      clipLoadToken: { attribute: false },
      clipAttemptId: { attribute: false },
      doorbellOnly: { attribute: false },
      _cameraAudio: { state: true },
      _clipMode: { state: true },
      _talkState: { state: true },
      _talkMuted: { state: true },
      _talkAudioBlocked: { state: true },
      _provider: { state: true },
      _loading: { state: true },
      _error: { state: true },
      _isHD: { state: true },
      _mjpegSignedUrl: { state: true },
    };
  }

  constructor() {
    super();
    this._provider = null;
    this._loading = true;
    this._error = null;
    this._isHD = false;
    this._mjpegSignedUrl = null;
    this._lc = null;
    this._started = false;
    this._startToken = 0;
    this._clipMode = false;
    this._clipListenersCleanup = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }

  updated(changed) {
    if (!this.isConnected) return;
    if (!this._started && this.hass && this.cameraId && this.cardConfig) {
      this._started = true;
      this._start();
    } else if (
      this._started &&
      (changed.has("cardConfig") || changed.has("cameraId")) &&
      !this._clipMode &&
      !this.clipUrl
    ) {
      this._start();
    }
    if (this.doorbellOnly) return;
    const clipSourceChanged =
      changed.has("clipUrl") ||
      changed.has("clipAttemptId") ||
      changed.has("clipSourceKind");
    const wantsClip =
      !!this.clipUrl || !!this.clipError || !!this.clipLoading;
    if (clipSourceChanged) {
      if (wantsClip) {
        this._enterClipMode();
      } else if (this._clipMode) {
        this._exitClipMode();
      }
    } else if (
      (changed.has("clipError") || changed.has("clipLoading")) &&
      wantsClip &&
      !this._clipMode
    ) {
      this._enterClipMode();
    } else if (
      (changed.has("clipError") || changed.has("clipLoading")) &&
      !wantsClip &&
      this._clipMode
    ) {
      this._exitClipMode();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._started = false;
    this._cleanupLivestream();
    this._cleanupClip();
  }

  async _enterClipMode() {
    this._clipMode = true;
    this._cleanupLivestream();
    this._provider = null;
    this._loading = false;
    this._error = null;
    await this.updateComplete;
    const v = this.renderRoot?.querySelector("video.clip");
    if (!v || !this.clipUrl) return;
    const url = this.clipUrl;
    const token = this.clipLoadToken;
    const attemptId = this.clipAttemptId;
    const timeoutMs = this.clipSourceKind === "resolved_hls" ? 60000 : 40000;
    const isHls = /\.m3u8($|\?)/i.test(url);
    this._cleanupClip();
    let settled = false;
    let timer = null;
    const isCurrent = () =>
      this.clipUrl === url &&
      this.clipLoadToken === token &&
      this.clipAttemptId === attemptId;
    const cleanupLoadingListeners = () => {
      if (timer) clearTimeout(timer);
      v.removeEventListener("loadedmetadata", onLoaded);
    };
    const cleanupListeners = () => {
      cleanupLoadingListeners();
      v.removeEventListener("error", onNativeError);
      if (this._clipListenersCleanup === cleanupListeners) {
        this._clipListenersCleanup = null;
      }
    };
    const emitFailure = (kind, message, status = null, details = "") => {
      this.dispatchEvent(new CustomEvent("clip-source-error", {
        detail: { token, attemptId, kind, message, status, details },
        bubbles: true,
        composed: true,
      }));
    };
    const dispatchFailure = (kind, message, status = null, details = "") => {
      if (settled || !isCurrent()) return;
      settled = true;
      cleanupListeners();
      if (this._hls) {
        try { this._hls.destroy(); } catch {}
        this._hls = null;
      }
      emitFailure(kind, message, status, details);
    };
    const onLoaded = () => {
      if (settled || !isCurrent()) return;
      settled = true;
      cleanupLoadingListeners();
      this.dispatchEvent(new CustomEvent("clip-source-loaded", {
        detail: { token, attemptId },
        bubbles: true,
        composed: true,
      }));
      this._tryAutoplay(v);
    };
    const onNativeError = () => {
      if (!isCurrent()) return;
      const code = v?.error?.code;
      const kind =
        code === 2
          ? "network"
          : code === 3 || code === 4
            ? "decoder"
            : "unknown";
      if (settled) {
        cleanupListeners();
        emitFailure(kind, v?.error?.message || "Video playback failed");
      } else {
        dispatchFailure(kind, v?.error?.message || "Video playback failed");
      }
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("error", onNativeError);
    timer = setTimeout(
      () => dispatchFailure("timeout", `Clip timeout after ${timeoutMs}ms`),
      timeoutMs
    );
    this._clipListenersCleanup = cleanupListeners;

    if (isHls && !this._hlsNativeSupported()) {
      try {
        const Hls = await loadHls();
        if (!isCurrent()) {
          cleanupListeners();
          return;
        }
        if (Hls && Hls.isSupported()) {
          this._hls = new Hls({
            maxBufferLength: 30,
            fragLoadPolicy: {
              default: {
                maxTimeToFirstByteMs: timeoutMs,
                maxLoadTimeMs: timeoutMs,
                timeoutRetry: { maxNumRetry: 0 },
                errorRetry: { maxNumRetry: 0 },
              },
            },
            manifestLoadPolicy: {
              default: {
                maxTimeToFirstByteMs: timeoutMs,
                maxLoadTimeMs: timeoutMs,
                timeoutRetry: { maxNumRetry: 0 },
                errorRetry: { maxNumRetry: 0 },
              },
            },
          });
          this._hls.loadSource(url);
          this._hls.attachMedia(v);
          this._hls.on(Hls.Events.MANIFEST_PARSED, () => this._tryAutoplay(v));
          this._hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data?.fatal) return;
            const details = data.details || data.type || "";
            const kind = /timeout|timeOut/i.test(details)
              ? "timeout"
              : /Parsing|decode/i.test(details)
                ? "decoder"
                : "network";
            const status =
              data?.response?.code ?? data?.response?.status;
            if (settled && isCurrent()) {
              cleanupListeners();
              emitFailure(kind, `HLS: ${details}`, status, details);
            } else {
              dispatchFailure(
                kind,
                `HLS: ${details}`,
                status,
                details
              );
            }
          });
          return;
        }
      } catch (error) {
        dispatchFailure(
          /timeout/i.test(String(error?.message || error))
            ? "timeout"
            : "network",
          error?.message || String(error)
        );
        return;
      }
    }
    v.src = url;
    try { v.load(); } catch {}
    this._tryAutoplay(v);
  }

  _cleanupClip() {
    if (this._clipListenersCleanup) {
      this._clipListenersCleanup();
      this._clipListenersCleanup = null;
    }
    if (this._hls) { try { this._hls.destroy(); } catch {} this._hls = null; }
    const v = this.renderRoot?.querySelector("video.clip");
    if (v) { try { v.pause(); } catch {} v.removeAttribute("src"); try { v.load(); } catch {} }
  }

  async _exitClipMode() {
    this._clipMode = false;
    this._cleanupClip();
    this._loading = true;
    await this.updateComplete;
    this._start();
  }

  _closeClip() {
    this.dispatchEvent(new CustomEvent("close-clip", { bubbles: true, composed: true }));
  }

  _camDisplayName() {
    return this.cameraEntry?.name || this.cameraId || "?";
  }

  _streamName(hd) {
    const e = this.cameraEntry || {};
    if (hd && e.main) return e.main;
    if (!hd && e.sub) return e.sub;
    return e.main || e.sub || this.cameraId;
  }

  /* Helpers reused by clip + render (live protocols live in LivestreamController) */
  async _tryAutoplay(v) {
    try { await v.play(); }
    catch (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) {
        v.muted = true;
        try { await v.play(); } catch {}
      }
    }
  }
  _hlsNativeSupported() {
    const v = document.createElement("video");
    return !!v.canPlayType && v.canPlayType("application/vnd.apple.mpegurl") !== "";
  }
  _isExternal() { return !isLocalNetwork(); }

  /* Livestream wrappers */
  _ensureLivestreamController() {
    if (this._lc) return this._lc;
    this._lc = new LivestreamController({
      logPrefix: "[FrigateVisionTile Live]",
      independentAudio: this.doorbellOnly,
      failedMessage: this.t?.live_failed,
      getConfig: () => this.cardConfig,
      getHass: () => this.hass,
      getVideoEl: () => this.renderRoot?.querySelector("video.player"),
      getStreamName: (hd) => this._streamName(hd),
      onUpdate: () => this.updateComplete,
      onState: (patch) => this._applyLiveState(patch),
    });
    return this._lc;
  }

  _applyLiveState(patch) {
    if ("loading" in patch) this._loading = !!patch.loading;
    if ("provider" in patch) this._provider = patch.provider ?? null;
    if ("talk" in patch) this._talkState = patch.talk;
    if ("talkMuted" in patch) this._talkMuted = patch.talkMuted;
    if ("talkAudioBlocked" in patch) this._talkAudioBlocked = patch.talkAudioBlocked;
    if ("error" in patch) this._error = patch.error ?? null;
    if ("mjpegUrl" in patch) this._mjpegSignedUrl = patch.mjpegUrl ?? null;
    if ("cameraAudio" in patch) this._cameraAudio = patch.cameraAudio;
  }

  _start() {
    if (!this.cameraId || !this.cardConfig) return;
    const token = ++this._startToken;
    this._loading = true;
    this._provider = null;
    this._error = null;
    const lc = this._ensureLivestreamController();
    lc.cleanup();
    const pendingGeneration = lc.runGeneration;
    lc._isHD = !!this._isHD;
    this.updateComplete.then(() => {
      if (token !== this._startToken || this._clipMode || this.clipUrl) return;
      lc.start(this.cameraId, pendingGeneration);
    });
  }

  _cleanupLivestream() {
    this._startToken++;
    this._lc?.cleanup();
  }

  _restart() {
    this._loading = true;
    this._provider = null;
    this._error = null;
    this._ensureLivestreamController().restart();
  }

  _toggleHD() {
    this._isHD = !this._isHD;
    this._ensureLivestreamController().setHD(this._isHD);
  }

  _hdButton() {
    return html`<button class="overlay-btn hd-sd-btn" @click=${() => this._toggleHD()} title=${this._isHD ? "HD Stream aktiv" : "SD Stream aktiv"}>
      <span class="hd-sd-label">${this._isHD ? "HD" : "SD"}</span></button>`;
  }

  render() {
    const t = this.t || {};
    const name = this._camDisplayName();
    if (this._clipMode) {
      return html`
        <div class="player-wrap clip">
          ${this.clipError ? html`<div class="error">${this.clipError}</div>` : ""}
          ${this.clipLoading && !this.clipError ? html`<div class="loading">${t.loading_clip || "Lade Clip…"}</div>` : ""}
          <video class="clip player" playsinline controls></video>
          <div class="live-controls">
            <span class="live-cam-name">${name}</span>
            <span class="live-indicator"><ha-icon icon="mdi:play-circle"></ha-icon> CLIP</span>
          </div>
          <div class="player-top-buttons">
            <button class="overlay-btn" @click=${() => this._closeClip()} title=${t.close || "Schließen"}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
        </div>
      `;
    }
    const e = this.cameraEntry || {};
    const hasHdSd = e.main && e.sub && e.main !== e.sub;
    const cfg = this.cardConfig || {};
    const showLiveControls = !this.doorbellOnly && cfg.live_controls !== false;
    const liveControlsPos = cfg.live_controls_position === "top" ? "top" : "bottom";
    const showHdSd = !this.doorbellOnly && cfg.hd_sd_button !== false;
    const hdSdPos = cfg.hd_sd_button_position === "bottom" ? "bottom" : "top";
    return html`
      <div class="player-wrap live ${this.doorbellOnly ? "doorbell-only" : ""}">
        ${this._loading ? html`<div class="loading">${t.live_connecting || "Verbinde…"}</div>` : ""}
        ${this._error ? html`<div class="error">${this._error}</div>` : ""}
        ${this._provider === "mjpeg"
          ? (this._mjpegSignedUrl
              ? html`<img class="live-mjpeg" src=${this._mjpegSignedUrl} />`
              : html`<div class="loading">${t.live_connecting || "…"}</div>`)
          : html`<video class="player" autoplay playsinline muted
              controlslist=${hasDoorbellOverlay(cfg, e.doorbell) && canFullscreenPlayer() ? "nofullscreen" : ""}
              ?controls=${!this.doorbellOnly}></video>`}
        ${showLiveControls ? html`
          <div class="live-controls live-controls--${liveControlsPos}">
            <span class="live-cam-name">${name}</span>
            <span class="live-indicator">
              <span class="live-dot"></span> LIVE
              ${this._provider ? html`<span class="live-proto">${this._provider.toUpperCase()}</span>` : ""}
              <span class="live-proto">${this._isExternal() ? "EXTERN" : "LAN"}</span>
            </span>
          </div>
        ` : ""}
        ${!this.doorbellOnly ? html`<div class="player-top-buttons hd-sd-wrap--top">
          ${this._provider && !this._loading && !this._error
            ? renderCameraControls(this.hass, cfg, this.instanceId, this.cameraId, this._lc, this._talkState, t, e.doorbell) : ""}
          ${hasHdSd && showHdSd && hdSdPos === "top" ? this._hdButton() : ""}
        </div>` : ""}
        ${this._provider && !this._loading && !this._error
          ? renderDoorbell(this.hass, cfg, this.cameraId, this._lc, this._talkState, this._talkMuted, this._talkAudioBlocked, t, e.doorbell,
              this.doorbellOnly, this.doorbellOnly && this._provider !== "mjpeg" ? this._cameraAudio || "off" : null) : ""}
        ${hasHdSd && showHdSd && hdSdPos === "bottom" ? html`
          <div class="player-top-buttons hd-sd-wrap--bottom">${this._hdButton()}</div>` : ""}
      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; }
      .player-wrap {
        position: relative;
        background: transparent;
        border-radius: 4px;
        overflow: hidden;
        height: auto;
      }
      video.player, .live-mjpeg {
        display: block; width: 100%; height: auto;
        background: transparent; object-fit: contain;
      }
      .doorbell-only { height: 100%; }
      .doorbell-only video.player, .doorbell-only .live-mjpeg { height: 100%; max-height: 100%; }
      .player-wrap.live:fullscreen { width: 100%; height: 100%; background: black; }
      .player-wrap.live:fullscreen :is(video.player, .live-mjpeg) { height: 100%; max-height: none; }
      .loading, .error {
        position: absolute; inset: 0; display: flex;
        align-items: center; justify-content: center;
        color: #fff; font-size: 0.9em; pointer-events: none;
        background: rgba(0,0,0,0.3);
      }
      .error { color: #ff6b6b; background: rgba(0,0,0,0.6); }
      .live-controls {
        position: absolute; left: 8px;
        display: flex; gap: 8px; align-items: center;
        color: #fff; font-size: 0.82em;
        background: rgba(0,0,0,0.55);
        padding: 4px 8px; border-radius: 12px;
        pointer-events: none;
      }
      .live-controls--bottom { bottom: 8px; }
      .live-controls--top { top: 8px; }
      .live-indicator { display: flex; align-items: center; gap: 6px; }
      .live-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #e53935; display: inline-block;
        box-shadow: 0 0 6px #e53935;
        animation: livedot 1.4s infinite ease-in-out;
      }
      @keyframes livedot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      .live-proto {
        font-size: 0.7em; opacity: 0.7; text-transform: uppercase;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 1px 4px; border-radius: 3px;
      }
      .player-top-buttons {
        position: absolute; right: 6px;
        display: flex; gap: 6px; z-index: 2;
      }
      .hd-sd-wrap--top { top: 6px; }
      .hd-sd-wrap--bottom { bottom: 6px; }
      .overlay-btn {
        background: rgba(0,0,0,0.55); color: #fff; border: none;
        border-radius: 50%; width: 32px; height: 32px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        --mdc-icon-size: 18px;
      }
      .overlay-btn:hover { background: rgba(0,0,0,0.75); }
      .hd-sd-btn { border-radius: 6px !important; min-width: 36px; }
      .hd-sd-label { font-weight: 700; font-size: 11px; letter-spacing: 0.5px; line-height: 1; }
    `;
  }
}

if (!customElements.get("frigate-vision-talk-button")) {
  customElements.define("frigate-vision-talk-button", FrigateVisionTalkButton);
}
if (!customElements.get("frigate-vision-doorbell")) {
  customElements.define("frigate-vision-doorbell", FrigateVisionDoorbell);
}
if (!customElements.get("frigate-vision-ptz")) {
  customElements.define("frigate-vision-ptz", FrigateVisionPtz);
}

if (!customElements.get("frigate-vision-live-tile")) {
  customElements.define("frigate-vision-live-tile", FrigateVisionLiveTile);
}

if (!customElements.get("frigate-vision-card-editor")) {
  customElements.define(
    "frigate-vision-card-editor",
    FrigateVisionCardEditor
  );
}

if (!customElements.get("frigate-vision-card")) {
  customElements.define(
    "frigate-vision-card",
    FrigateVisionCard
  );
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "frigate-vision-card")) {
  window.customCards.push({
    type: "frigate-vision-card",
    name: "Frigate Vision Card",
    description:
      "Frigate events and reviews with exact event descriptions, live view, timeline and clip playback.",
    preview: false,
  });
}

console.info(
  `%c FRIGATE-VISION-CARD %c v${CARD_VERSION} `,
  "color: white; background: #039be5; font-weight: 700;",
  "color: #039be5; background: white; font-weight: 700;"
);

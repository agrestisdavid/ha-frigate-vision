# Beta-Test: 0.3.5-beta.1

`0.3.5-beta.1` ist ein Vorab-Release zum Testen. Die stabile Version bleibt
`0.3.4`. Diese Checkliste beschreibt einen bewussten Test in einer produktiven
Home-Assistant-Installation; sie behauptet **nicht**, dass ein Downgrade auf
deiner Installation getestet wurde.

## Vor der Installation

1. Notiere die installierte stabile Version und erstelle manuell ein Backup von
   Home Assistant, einschließlich Frigate-Vision-Konfiguration und
   Lovelace-Einrichtung.
2. Halte die Release-Referenz `v0.3.4` bereit, damit sie beim Downgrade wieder
   ausgewählt werden kann.
3. Lies die [Sicherheitshinweise](security.md) und plane ein Zeitfenster, in
   dem vorübergehende Fehler beim Card-Rendering oder Live-Stream akzeptabel
   sind.
4. Diese Beta ruft Frigate-Vision-Dienste nicht automatisch auf, ändert keine
   Automationen, migriert keine Konfiguration und schreibt keine Frigate-Daten.
   Bereits aktive Automationen können gemäß ihrer eigenen Konfiguration weiter
   laufen; deaktiviere sie selbst, falls das für das Testfenster nötig ist.

## Installation und Test mit HACS

1. Füge `agrestisdavid/ha-frigate-vision` in HACS als benutzerdefiniertes
   Repository vom Typ **Integration** hinzu, falls es noch nicht vorhanden ist.
2. Wähle den Vorab-Release `v0.3.5-beta.1`, wenn HACS ihn anbietet, lade ihn
   herunter und starte Home Assistant neu. Der HACS-Quellcode unterstützt
   Beta-Filterung und die Anzeige von Vorab-Versionen; Auswahl und Sichtbarkeit
   hängen jedoch von der installierten HACS-Oberfläche ab. Setze keinen
   bestimmten Schalter voraus, ohne ihn in dieser Oberfläche zu prüfen.
3. Bestätige, dass Frigate Vision startet und eine vorhandene
   `custom:frigate-vision-card` ohne zusätzliche Lovelace-Ressource lädt.
4. Prüfe möglichst mit synthetischen oder nicht-sensiblen Testereignissen:
   Ereignis-Rendering, Filteränderungen, Editor-Änderungen, Öffnen und
   Schließen eines Clips sowie Öffnen/Schließen eines Live-Streams. Teste die
   Browser und Netzwerkpfade deiner Installation. HLS-Wiedergabe kann je nach
   MSE- oder nativer-HLS-Unterstützung des Browsers abweichen.
5. Prüfe Home-Assistant-Logs und Browser-Konsole auf Card-, Medien- oder
   Worker-Fehler. Keine Provider-Schlüssel, signierten URLs, Ereignis-IDs oder
   privaten Hosts in Fehlerberichte aufnehmen.

## Downgrade

1. Wähle in HACS `v0.3.4`, wenn die Release-Auswahl es anbietet, lade die
   Version herunter und starte Home Assistant neu. Wenn die Auswahl das Release
   nicht zeigt, nutze das dokumentierte HACS-/Custom-Repository-
   Wiederherstellungsverfahren und das vor dem Test erstellte manuelle Backup.
2. Lade das Dashboard neu und bestätige, dass die Card die stabile `0.3.4`
   meldet.
3. Aktiviere selbst pausierte Automationen wieder und prüfe ihr normales
   Verhalten selbst.

Das Repository hat diesen Downgrade nicht auf deinem Home Assistant ausgeführt
und die Release-Auswahl nicht mit deiner installierten HACS-Oberfläche
validiert. Gib bei Beta-Installations-Ergebnissen die installierten HACS- und
Home-Assistant-Versionen an.

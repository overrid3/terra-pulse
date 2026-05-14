# TerraPulse Mobile (stub)

The Flutter mechanic app is deferred for the POC. See `Pre plan prompt 1.md` §"Mobile Edge Computing and Telemetry" for the target architecture (Flutter + flutter_foreground_task + geolocator + MQTT).

For now, mechanic GPS updates are simulated via the backend dev-only endpoint:

```
POST /api/dev/simulate-move
{ "mechanicId": "...", "lat": 45.46, "lng": 9.19 }
```

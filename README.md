# MQTT-Web-Terminal

Bring any Linux device/server to the web, whenever they have public ip or not


## Config

Modify app.js and main.py

## On Raspberry PI

```sh
python -m venv .venv
. .venv/bin/activatte
pip install -r requirements.txt

python3 main.py
```

## On your PC

```sh
python -m http.server
```

## Web Terminal

open http://127.0.0.1:8000

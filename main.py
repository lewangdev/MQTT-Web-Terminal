import pty
import os
import subprocess
import select
import termios
import struct
import fcntl
import shlex
import logging
import json
import paho.mqtt.client as mqtt
import threading


class AttrDict(dict):
    def __init__(self, *args, **kwargs):
        super(AttrDict, self).__init__(*args, **kwargs)
        self.__dict__ = self


app = AttrDict(config=AttrDict(fd=None, cmd="sh"))


def set_winsize(fd, row, col, xpix=0, ypix=0):
    logging.debug("setting window size with termios")
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


def resize(data):
    if app.config["fd"]:
        logging.debug(f"Resizing window to {data['rows']}x{data['cols']}")
        set_winsize(app.config["fd"], data["rows"], data["cols"])


def read_and_forward_pty_output(mqttc):
    max_read_bytes = 1024 * 20
    while True:
        if app.config["fd"]:
            timeout_sec = 30
            (data_ready, _, _) = select.select([app.config["fd"]], [], [], timeout_sec)
            print(data_ready)
            if data_ready:
                output = os.read(app.config["fd"], max_read_bytes).decode(
                    errors="ignore"
                )
                mqttc.publish("/pty-output", json.dumps({"output": output}))


def pty_input(data):
    """write to the child pty. The pty sees this as if you are typing in a real
    terminal.
    """
    if app.config["fd"]:
        logging.debug("received input from browser: %s" % data["input"])
        os.write(app.config["fd"], data["input"].encode())


def mqtt_on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))

    # Subscribing in on_connect() means that if we lose the connection and
    # reconnect then subscriptions will be renewed.
    client.subscribe("/pty-input")
    client.subscribe("/resize")
    t1 = threading.Thread(target=read_and_forward_pty_output, args=(client,))
    t1.start()


# The callback for when a PUBLISH message is received from the server.
def mqtt_on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode('utf8')
    data = json.loads(payload)
    print(msg.topic+" "+payload)
    if topic == '/pty-input':
        pty_input(data)
    elif topic == '/resize':
        resize(data)


if __name__ == "__main__":
    # create child process attached to a pty we can read from and write to
    (child_pid, fd) = pty.fork()
    if child_pid == 0:
        # this is the child process fork.
        # anything printed here will show up in the pty, including the output
        # of this subprocess
        subprocess.run(app.config["cmd"])
    else:
        # this is the parent process fork.
        # store child fd and pid
        app.config["fd"] = fd
        app.config["child_pid"] = child_pid
        set_winsize(fd, 50, 50)
        cmd = " ".join(shlex.quote(c) for c in app.config["cmd"])

    client = mqtt.Client()
    client.on_connect = mqtt_on_connect
    client.on_message = mqtt_on_message

    client.connect("192.168.52.164", 2883, 60)

    # Blocking call that processes network traffic, dispatches callbacks and
    # handles reconnecting.
    # Other loop*() functions are available that give a threaded interface and a
    # manual interface.
    client.loop_forever()
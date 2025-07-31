// src/utils/mqttClient.ts

import mqtt from 'mqtt';
import { MQTT_URL, MQTT_USER, MQTT_PASSWORD } from '../configs/config';

export const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USER,
  password: MQTT_PASSWORD,
});

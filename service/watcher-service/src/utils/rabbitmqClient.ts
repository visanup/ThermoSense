// src/utils/rabbitmqClient.ts

import * as amqp from 'amqplib';
import {
  RABBITMQ_HOST,
  RABBITMQ_PORT,
  RABBITMQ_USER,
  RABBITMQ_PASSWORD,
  RABBITMQ_VHOST,
  RABBITMQ_EXCHANGE,
} from '../configs/config';

let connection: any = null;
let channel: any = null;
let connecting: Promise<any> | null = null;

export async function getChannel(): Promise<any> {
  if (channel) {
    return channel;
  }

  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    try {
      connection = await amqp.connect({
        protocol: 'amqp',
        hostname: RABBITMQ_HOST,
        port: RABBITMQ_PORT,
        username: RABBITMQ_USER,
        password: RABBITMQ_PASSWORD,
        vhost: RABBITMQ_VHOST,
      });

      connection.on('error', (err: any) => {
        console.error('RabbitMQ connection error:', err);
        channel = null;
      });

      connection.on('close', () => {
        console.warn('RabbitMQ connection closed');
        channel = null;
      });

      const ch = await connection.createChannel();
      await ch.assertExchange(RABBITMQ_EXCHANGE, 'direct', { durable: true });

      channel = ch;
      return ch;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

export async function closeRabbitMQ() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
  } catch (e) {
    console.warn('Error closing RabbitMQ connection:', e);
  }
}






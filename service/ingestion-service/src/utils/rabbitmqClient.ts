// src/utils/rabbitmqClient.ts

import amqp from 'amqplib';
import {
  RABBITMQ_HOST,
  RABBITMQ_PORT,
  RABBITMQ_USER,
  RABBITMQ_PASSWORD,
  RABBITMQ_VHOST,
  RABBITMQ_EXCHANGE,
} from '../configs/config';

let channel: amqp.Channel;

export async function getChannel() {
  if (channel) return channel;
  const conn = await amqp.connect({
    protocol: 'amqp',
    hostname: RABBITMQ_HOST,
    port: RABBITMQ_PORT,
    username: RABBITMQ_USER,
    password: RABBITMQ_PASSWORD,
    vhost: RABBITMQ_VHOST,
  });
  channel = await conn.createChannel();
  await channel.assertExchange(RABBITMQ_EXCHANGE, 'direct', { durable: true });
  return channel;
}

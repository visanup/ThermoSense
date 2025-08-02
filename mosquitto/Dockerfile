FROM eclipse-mosquitto:2.0

COPY mosquitto.conf /mosquitto/config/mosquitto.conf
COPY passwd /mosquitto/config/passwd

# สิทธิ์พอใช้ (โดยปกติไฟล์ที่ copy มาใน image จะโอเคอยู่แล้ว)
RUN chmod 600 /mosquitto/config/passwd

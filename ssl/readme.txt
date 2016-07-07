Place private key and certificate files here:
key.pem - your private key
cert.pem - your certificate

You can create it with openssl:

openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 100 -nodes
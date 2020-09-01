FROM node:12
RUN apt-get update -y && apt-get install git -y
COPY . .
RUN npm i
CMD [ "node", "main.js" ]
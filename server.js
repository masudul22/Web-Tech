const http = require('http'); 
const server = http.createServer((req, res) => {
  res.end("Development environment working!");
});
server.listen(3000);
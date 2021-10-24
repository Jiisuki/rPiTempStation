var http = require('http');
var chart = require('chart.js');

var fn = 'temp_log/2021/10/24/11.csv';

var tmp_list = [];

const csv = require('csv-parser');
const fs = require('fs');

fs.createReadStream(fn)
    .pipe(csv({headers:['year', 'month', 'day', 'hour', 'minute', 'second', 'cpu']}))
    .on('data', (row) => {
        //var date = row['year'] + '-' + row['month'] + '-' + row['day'];
        //var time = row['hour'] + ':' + row['minute'];
        var cpu_t = parseFloat(row['cpu']);
        tmp_list.push(cpu_t);
        //console.log(date + ' @ ' + time + ' => ' + cpu_t + ' deg.');
    })
    .on('end', () => {
        console.log('CSV file processed, ' + tmp_list.length + ' entries.');
    });

var server = http.createServer(function (req, res)
{
    if (req.url == '/')
    {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write('<html>');
        res.write('<body><p>We have ' + tmp_list.length + ' data points.</p></body>');
        res.write('</html>');
        res.end();
    }
});

server.listen(5000);
console.log("Server running at :5000");

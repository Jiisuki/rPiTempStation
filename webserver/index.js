var http = require('http');
var chart = require('chart.js');

var fn = 'temp_log/2021/10/24/20.csv';

var ts = [];
var tmp_list = [];

const csv = require('csv-parser');
const fs = require('fs');

fs.createReadStream(fn)
    .pipe(csv({headers:['year', 'month', 'day', 'hour', 'minute', 'second', 'cpu']}))
    .on('data', (row) => {
        var date = row['year'] + '-' + row['month'] + '-' + row['day'];
        var time = row['hour'] + ':' + row['minute'];
        var cpu_t = parseFloat(row['cpu']);

        tmp_list.push(cpu_t);
        ts.push(date + " - " + time);
    })
    .on('end', () => {
        console.log('CSV file processed, ' + tmp_list.length + ' entries.');
    });

var server = http.createServer(function (req, res)
{
    fs.readFile('index.html', 'utf-8', function (err, data)
    {
        res.writeHead(200, {'Content-Type': 'text/html'});

        var x = [];
        for (var i = 0; i < tmp_list.length; i++)
            x.push(i);

        data = data.replace('{cpu_temp}', JSON.stringify(tmp_list));
        data = data.replace('{xval}', JSON.stringify(ts));

        res.write(data);
        res.end();
    });
}).listen(5000, '127.0.0.1');

console.log("Server running at 127.0.0.1:5000/");

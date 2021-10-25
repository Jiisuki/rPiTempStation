var http = require('http');
var chart = require('chart.js');
var path = require('path');
var util = require('util');
let glob = require('glob');

const csv = require('csv-parser');
const fs = require('fs');

function get_tree (dir) {
    let tree = glob.sync(dir + '/**/**/*.csv');
    return tree;
}

let tree = get_tree('temp_log');
console.log(tree.length + ' files found:');
tree.forEach(function(item, index, array) {
    console.log(index, item);
});

let tmp_list = [];
let ts = [];

async function read_file(file, precision) {
    let promise = new Promise(function(resolve, reject) {
        /* Set timeout for parsing the data. */
        setTimeout(() => reject(new Error('Unable to parse.')), 1000);

        /* Setup accumulators. */

        /* Read the file async. */
        fs.createReadStream(file)
            .pipe(csv({headers: ['year', 'month', 'day', 'hour', 'minute', 'second', 'cpu']}))
            .on('data', (row) => {
                let date = row['year'] + '-' + row['month'] + '-' + row['day'];
                let time = row['hour'] + ':' + row['minute'];
                let cpu_t = parseFloat(row['cpu']);

                tmp_list.push(cpu_t);
                ts.push(date + " - " + time);
            })
            .on('end', () => {
                resolve('done');
            });
    });

    return promise;
}


var server = http.createServer(function (req, res)
{
    /* Clear data. */
    ts = [];
    tmp_list = [];

    let promise = read_file(tree[0], 'hour');

    promise.then(
        function(result) { /* handle a successful result */
            console.log('CSV file processed, ' + tmp_list.length + ' entries.');

            fs.readFile('index.html', 'utf-8', function (err, data)
            {
                res.writeHead(200, {'Content-Type': 'text/html'});

                data = data.replace('{title_str}', tree[0]);
                data = data.replace('{cpu_temp}', JSON.stringify(tmp_list));
                data = data.replace('{xval}', JSON.stringify(ts));

                res.write(data);
                res.end();
            });
        },
        function(error) { /* handle an error */
            console.log('Error processing file.');
            fs.readFile('error.html', 'utf-8', function (err, data)
            {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.write(data);
                res.end();
            });
        }
    );

}).listen(5000);

console.log("Server listening on port 5000...");

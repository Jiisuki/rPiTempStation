const http = require('http');
const glob = require('glob');
const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');

//moment.locale('sv-SE');
moment.locale('en-GB');
const tz = '+0200';
const decimation_interval_min = 30;

function get_tree (dir) {
    let tree = glob.sync(dir + '**/**/*.csv');
    tree.forEach(function (value, index) {
        tree[index] = tree[index].substr(dir.length);
        tree[index] = tree[index].substr(0, tree[index].length - '.csv'.length);
    });
    return tree;
}

let base_dir = 'temp_log/minute_logs/';
if (2 < process.argv.length) {
    console.log('Using base directory: "' + process.argv[2] + '"');
    base_dir = process.argv[2] + '/temp_log/minute_logs/';
}

let last_update_file = 'temp_log/last_minute.csv';
if (2 < process.argv.length) {
    last_update_file = process.argv[2] + '/temp_log/last_minute.csv';
}

let tree = get_tree(base_dir);
console.log(tree.length + ' files found:');
tree.forEach(function(item, index) {
    console.log(index, item);
});

let temp_list_cpu = [];
let temp_list_cabinet = [];
let temp_list_inside = [];
let temp_list_outside = [];
let dates = [];
let ts = [];
let n_data_points = 0;

function clear_globals() {
    ts = [];
    dates = [];
    n_data_points = 0;
    temp_list_cpu = [];
    temp_list_cabinet = [];
    temp_list_inside = [];
    temp_list_outside = [];
}

function generate_file_options(selected) {
    let options = "";
    tree.forEach(function (value, index) {
        let v = value.replace(/\//g, '-');
        if (value === selected)
        {
            options += '<option value="' + v + '" selected>' + v + '</option>';
        }
        else {
            options += '<option value="' + v + '">' + v + '</option>';
        }
    });
    return options;
}

async function read_file(file, interval_minute) {
    return new Promise(function (resolve, reject) {
        /* Set timeout for parsing the data. */
        setTimeout(() => reject(new Error('Unable to parse.')), 1000);

        /* Setup accumulators. */
        let cpu_t = 0.0;
        let cabinet_t = 0.0;
        let inside_t = 0.0;
        let outside_t = 0.0;
        n_data_points = 0;

        /* Iteration memory. */
        let date = "";
        let time = "";
        let unixTimestamp = 0;
        let unixTs0 = 0;

        /* Read the file async. */
        fs.createReadStream(file)
            .pipe(csv({headers: ['ts', 'cpu', 'cabinet', 'inside', 'outside']}))
            .on('data', (row) => {
                unixTimestamp = parseInt(row['ts']);

                cpu_t = parseFloat(row['cpu']);
                cabinet_t = parseFloat(row['cabinet']);
                inside_t = parseFloat(row['inside']);
                outside_t = parseFloat(row['outside']);


                if ((interval_minute * 60) <= (unixTimestamp - unixTs0)) {
                    temp_list_cpu.push(cpu_t);
                    temp_list_cabinet.push(cabinet_t);
                    temp_list_inside.push(inside_t);
                    temp_list_outside.push(outside_t);
                    dates.push(moment(unixTimestamp, 'X').utcOffset(tz).format('L'));
                    ts.push(unixTimestamp);
                    n_data_points++;
                    unixTs0 = unixTimestamp;
                }
            })
            .on('end', () => {
                temp_list_cpu.push(cpu_t);
                temp_list_cabinet.push(cabinet_t);
                temp_list_inside.push(inside_t);
                temp_list_outside.push(outside_t);
                dates.push(moment(unixTimestamp, 'X').utcOffset(tz).format('L'));
                ts.push(unixTimestamp);
                n_data_points++;

                resolve('done');
            })
            .on('error', () => {
                reject('error');
            });
    });
}

let last_ping_date = "";
let last_ping_time = "";
let last_ping_cpu_t = 0;
let last_ping_cabinet_t = 0;
let last_ping_inside_t = 0;
let last_ping_outside_t = 0;

async function read_last_minute_file(file) {
    return new Promise(function (resolve, reject) {
        /* Set timeout for parsing the data. */
        setTimeout(() => reject(new Error('Unable to parse.')), 1000);

        /* Read the file async. */
        fs.createReadStream(file)
            .pipe(csv({headers: ['ts', 'cpu', 'cabinet', 'inside', 'outside']}))
            .on('data', (row) => {
                //last_ping_date = "2021-01-01";
                //last_ping_time = row['ts'];
                last_ping_date = (moment(parseInt(row['ts']), 'X').utcOffset(tz).format('LLL'));

                last_ping_cpu_t = parseFloat(row['cpu']);
                last_ping_cabinet_t = parseFloat(row['cabinet']);
                last_ping_inside_t = parseFloat(row['inside']);
                last_ping_outside_t = parseFloat(row['outside']);
            })
            .on('end', () => {
                resolve('done');
            })
            .on('error', () => {
                reject('error');
            });
    });
}

var params=function(req) {
    let q = req.url.split('?'), result = {};
    if (q.length >= 2) {
        q[1].split('&').forEach((item) => {
            try {
                result[item.split('=')[0]] = item.split('=')[1];
            } catch (e) {
                result[item.split('=')[0]] = '';
            }
        })
    }
    return result;
}

var server = http.createServer(function (req, res)
{
    if (req.url !== '/favicon.ico') {
        /* Clear data. */
        clear_globals();

        /* Config. */
        let in_parameters = params(req);

        let filename = base_dir + tree[tree.length - 1];
        if (in_parameters.file)
        {
            filename = base_dir + in_parameters.file.replace(/-/gi, '/');
        }

        let last_minute_promise = read_last_minute_file(last_update_file);
        last_minute_promise.then(
            function (result) {
                console.log('Updated last minute information.');
            },
            function (error) { /* handle an error */
                console.log('Error processing file.');
                fs.readFile('error.html', 'utf-8', function (err, data) {
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.write(data);
                    res.end();
                });
            });

        console.log('Loading file: ' + filename + '.csv');
        let promise = read_file(filename + '.csv', decimation_interval_min);

        promise.then(
            function (result) { /* handle a successful result */
                fs.readFile('index.html', 'utf-8', function (err, data) {
                    res.writeHead(200, {'Content-Type': 'text/html'});

                    /* Data sets */
                    data = data.replace(/{cpu_temp}/g, JSON.stringify(temp_list_cpu));
                    data = data.replace(/{cabinet_temp}/g, JSON.stringify(temp_list_cabinet));
                    data = data.replace(/{inside_temp}/g, JSON.stringify(temp_list_inside));
                    data = data.replace(/{outside_temp}/g, JSON.stringify(temp_list_outside));

                    /* Time series */
                    //data = data.replace(/{xval}/g, JSON.stringify(ts));
                    data = data.replace(/{xval}/g, JSON.stringify(ts.map(e => e * 1000)));

                    /* Debug info. */
                    data = data.replace(/{n_data_points}/g, JSON.stringify(n_data_points));

                    /* Last minute info. */
                    data = data.replace(/{last_cpu_t}/g, JSON.stringify(last_ping_cpu_t));
                    data = data.replace(/{last_cabinet_t}/g, JSON.stringify(last_ping_cabinet_t));
                    data = data.replace(/{last_inside_t}/g, JSON.stringify(last_ping_inside_t));
                    data = data.replace(/{last_outside_t}/g, JSON.stringify(last_ping_outside_t));
                    data = data.replace(/{last_date}/g, last_ping_date);
                    data = data.replace(/{last_time}/g, last_ping_time);

                    /* Manage options. */
                    let options = generate_file_options(filename.substr(base_dir.length));
                    data = data.replace(/{opt_prec}/g, options);

                    res.write(data);
                    res.end();
                });
            },
            function (error) { /* handle an error */
                console.log('Error processing file.');
                fs.readFile('error.html', 'utf-8', function (err, data) {
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.write(data);
                    res.end();
                });
            }
        );
    }

}).listen(5000);

let addr = server.address();
console.log("Server listening on port %d, using %s", addr['port'], addr['family']);

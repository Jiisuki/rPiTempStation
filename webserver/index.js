const http = require('http');
const glob = require('glob');
const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');

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

async function read_file(file) {
    return new Promise(function (resolve, reject) {
        /* Set timeout for parsing the data. */
        setTimeout(() => reject(new Error('Unable to parse.')), 1000);

        /* Setup accumulators. */
        let acc_cpu_t = 0;
        let acc_cabinet_t = 0;
        let acc_inside_t = 0;
        let acc_outside_t = 0;

        let acc_count = 0;
        let acc_hour = 0;
        n_data_points = 0;

        /* Setup flags. */
        let flag_first = true;

        /* Iteration memory. */
        let mem_hour = -1;
        let date = "";
        let time = "";
        let unixTimestamp = 0;
        let unixTs0 = -1;

        /* Read the file async. */
        fs.createReadStream(file)
            .pipe(csv({headers: ['year', 'month', 'day', 'hour', 'minute', 'second', 'cpu', 'cabinet', 'inside', 'outside']}))
            .on('data', (row) => {
                date = row['year'] + '-' + row['month'] + '-' + row['day'];
                time = row['hour'] + ':' + row['minute'];

                unixTimestamp = moment(date + ' ' + time, 'YYYY-MM-DD HH:mm:ss').unix();

                let cpu_t = parseFloat(row['cpu']);
                let cabinet_t = parseFloat(row['cabinet']);
                let inside_t = parseFloat(row['inside']);
                let outside_t = parseFloat(row['outside']);
                let int_hour = parseInt(row['hour']);

                n_data_points++;

                let use_acc_count = false;
                let acc_max = 30;

                if (flag_first) {
                    flag_first = false;

                    acc_cpu_t = cpu_t;
                    acc_cabinet_t = cabinet_t;
                    acc_inside_t = inside_t;
                    acc_outside_t = outside_t;

                    acc_count = 1;
                    acc_hour = int_hour;
                    mem_hour = int_hour;
                    unixTs0 = unixTimestamp;
                } else {
                    /* Just accumulate. */
                    acc_cpu_t += cpu_t;
                    acc_cabinet_t += cabinet_t;
                    acc_inside_t += inside_t;
                    acc_outside_t += outside_t;

                    acc_count++;
                }

                if ((use_acc_count && (acc_max <= acc_count)) || (mem_hour !== int_hour)) {
                    temp_list_cpu.push(acc_cpu_t / acc_count);
                    temp_list_cabinet.push(acc_cabinet_t / acc_count);
                    temp_list_inside.push(acc_inside_t / acc_count);
                    temp_list_outside.push(acc_outside_t / acc_count);

                    dates.push(date);
                    ts.push(row['hour'] + ':' + row['minute']);
                    //ts.push(unixTimestamp);

                    /* Setup next start. */
                    acc_cpu_t = cpu_t;
                    acc_cabinet_t = cabinet_t;
                    acc_inside_t = inside_t;
                    acc_outside_t = outside_t;

                    acc_count = 1;
                    acc_hour = int_hour;
                    mem_hour = int_hour;
                }
            })
            .on('end', () => {
                /* Check if accumulator is running... */
                if (0 < acc_count) {
                    temp_list_cpu.push(acc_cpu_t / acc_count);
                    temp_list_cabinet.push(acc_cabinet_t / acc_count);
                    temp_list_inside.push(acc_inside_t / acc_count);
                    temp_list_outside.push(acc_outside_t / acc_count);

                    dates.push(date);
                    ts.push(time);
                    //ts.push(unixTimestamp);
                }

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
            .pipe(csv({headers: ['year', 'month', 'day', 'hour', 'minute', 'second', 'cpu', 'cabinet', 'inside', 'outside']}))
            .on('data', (row) => {
                last_ping_date = row['year'] + '-' + row['month'] + '-' + row['day'];
                last_ping_time = row['hour'] + ':' + row['minute'];

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
        let promise = read_file(filename + '.csv', false);

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
                    data = data.replace(/{xval}/g, JSON.stringify(ts));
                    //data = data.replace(/{xval}/g, JSON.stringify(ts.map(e => e * 1000)));

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

const https = require('https');
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

/* Read SSL certificate. */
const https_options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

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
let temp_list_inside = [];
let temp_list_outside = [];
let rh_list_inside = [];
let rh_list_outside = [];
let dates = [];
let ts = [];
let n_data_points = 0;
let n_total_points = 0;

function clear_globals() {
    ts = [];
    dates = [];
    n_data_points = 0;
    n_total_points = 0;
    temp_list_cpu = [];
    temp_list_inside = [];
    temp_list_outside = [];
    rh_list_inside = [];
    rh_list_outside = [];
}

function generate_file_options(selected) {
    let options = "";
    tree.forEach(function (value, index) {
        let v = value.replace(/\//g, '-');
        if (v === selected)
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
        let inside_t = 0.0;
        let outside_t = 0.0;
        let inside_rh = 0.0;
        let outside_rh = 0.0;
        n_data_points = 0;
        n_total_points = 0;

        /* Iteration memory. */
        let unixTimestamp = 0;
        let unixTs0 = 0;

        /* Read the file async. */
        fs.createReadStream(file)
            .pipe(csv({headers: ['ts', 'cpu', 'inside_t', 'inside_rh', 'outside_t', 'outside_rh']}))
            .on('data', (row) => {
                unixTimestamp = parseInt(row['ts']);

                cpu_t = parseFloat(row['cpu']);
                inside_t = parseFloat(row['inside_t']);
                outside_t = parseFloat(row['outside_t']);
                inside_rh = parseFloat(row['inside_rh']);
                outside_rh = parseFloat(row['outside_rh']);
                n_total_points++;

                if ((interval_minute * 30) <= (unixTimestamp - unixTs0)) {
                    temp_list_cpu.push(cpu_t);
                    temp_list_inside.push(inside_t);
                    temp_list_outside.push(outside_t);
                    rh_list_inside.push(inside_rh);
                    rh_list_outside.push(outside_rh);
                    dates.push(moment(unixTimestamp, 'X').utcOffset(tz).format('L'));
                    ts.push(unixTimestamp);
                    n_data_points++;
                    unixTs0 = unixTimestamp;
                }
            })
            .on('end', () => {
                temp_list_cpu.push(cpu_t);
                temp_list_inside.push(inside_t);
                temp_list_outside.push(outside_t);
                rh_list_inside.push(inside_rh);
                rh_list_outside.push(outside_rh);
                dates.push(moment(unixTimestamp, 'X').utcOffset(tz).format('L'));
                ts.push(unixTimestamp);
                n_data_points++;
                n_total_points++;

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

var server = https.createServer(https_options, function (req, res)
{
    if (req.url !== '/favicon.ico') {
        /* Clear data. */
        clear_globals();

        /* Update tree. */
        let old_count = tree.length;
        tree = get_tree(base_dir);
        if (old_count !== tree.length) {
            console.log('Updated tree structure.', tree.length + ' files found:');
            tree.forEach(function(item, index) {
                console.log(index, item);
            });
        }

        /* Config. */
        let in_parameters = params(req);
        let selected_option = '';

        let filename = base_dir + tree[tree.length - 1];
        if (in_parameters.file)
        {
            filename = base_dir + in_parameters.file.replace(/-/gi, '/');
            selected_option = in_parameters.file;
        }

        console.log('Loading file: ' + filename + '.csv');
        let promise = read_file(filename + '.csv', decimation_interval_min);

        promise.then(
            function (result) { /* handle a successful result */
                fs.readFile('index.html', 'utf-8', function (err, data) {
                    res.writeHead(200, {'Content-Type': 'text/html'});

                    /* Data sets */
                    data = data.replace(/{inside_temp}/g, JSON.stringify(temp_list_inside));
                    data = data.replace(/{outside_temp}/g, JSON.stringify(temp_list_outside));
                    data = data.replace(/{inside_rh}/g, JSON.stringify(rh_list_inside));
                    data = data.replace(/{outside_rh}/g, JSON.stringify(rh_list_outside));

                    /* Time series */
                    data = data.replace(/{xval}/g, JSON.stringify(ts.map(e => e * 1000)));

                    /* Debug info. */
                    data = data.replace(/{n_data_points}/g, JSON.stringify(n_data_points));
                    data = data.replace(/{n_total_points}/g, JSON.stringify(n_total_points));
                    data = data.replace(/{last_cpu_t}/g, JSON.stringify(temp_list_cpu[temp_list_cpu.length - 1]));

                    /* Manage options. */
                    console.log('Selected option:', selected_option);
                    let options = generate_file_options(selected_option);
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

}).listen(443);

//let addr = server.address();
//console.log("Server listening on port %d, using %s", addr['port'], addr['family']);

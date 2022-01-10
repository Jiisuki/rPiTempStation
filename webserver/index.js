const https = require('https');
const glob = require('glob');
const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');
const {value} = require("lodash/seq");

//moment.locale('sv-SE');
moment.locale('en-GB');
const tz = '+0200';

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
let temp_list_inside_lo = [];
let temp_list_inside_hi = [];
let temp_list_outside_lo = [];
let temp_list_outside_hi = [];
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
    temp_list_inside_lo = [];
    temp_list_inside_hi = [];
    temp_list_outside_lo = [];
    temp_list_outside_hi = [];
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

function generate_start_stop_dates() {
    let dates = [];
    let v0 = tree[0].replace(/\//g, '-');
    let v1 = tree[tree.length-1].replace(/\//g, '-');
    dates = [v0, v1];
    return dates;
}

async function read_file(file, interval_minute) {
    return new Promise(function (resolve, reject) {
        /* Set timeout for parsing the data. */
        setTimeout(() => reject(new Error('Unable to parse.')), 5000);

        /* Setup accumulators. */
        let cpu_t_lo = 1000.0;
        let cpu_t_hi = -1000.0;
        let inside_t_lo = 1000.0;
        let inside_t_hi = -1000.0;
        let outside_t_lo = 1000.0;
        let outside_t_hi = 0.0;
        let inside_rh_lo = 100.0;
        let inside_rh_hi = 0.0;
        let outside_rh_lo = 100.0;
        let outside_rh_hi = 0.0;
        n_data_points = 0;
        n_total_points = 0;

        /* Iteration memory. */
        let unixTimestamp = 0;
        let unixTs0 = 0;
        let date0 = 0;

        /* Read the file async. */
        fs.createReadStream(file)
            .on('error', () => {
                reject('error');
            })
            .pipe(csv({headers: ['ts', 'cpu', 'inside_t', 'inside_rh', 'outside_t', 'outside_rh']}))
            .on('data', (row) => {
                unixTimestamp = parseInt(row['ts']);

                cpu_t = parseFloat(row['cpu']);
                inside_t = parseFloat(row['inside_t']);
                outside_t = parseFloat(row['outside_t']);
                inside_rh = parseFloat(row['inside_rh']);
                outside_rh = parseFloat(row['outside_rh']);
                n_total_points++;

                // Figure out lo/hi points.
                if (cpu_t < cpu_t_lo)
                    cpu_t_lo = cpu_t;
                if (cpu_t_hi < cpu_t)
                    cpu_t_hi = cpu_t;
                if (inside_t < inside_t_lo)
                    inside_t_lo = inside_t;
                if (inside_t_hi < inside_t)
                    inside_t_hi = inside_t;
                if (outside_t < outside_t_lo)
                    outside_t_lo = outside_t;
                if (outside_t_hi < outside_t)
                    outside_t_hi = outside_t;
                if (inside_rh < inside_rh_lo)
                    inside_rh_lo = inside_rh;
                if (inside_rh_hi < inside_rh)
                    inside_rh_hi = inside_rh;
                if (outside_rh < outside_rh_lo)
                    outside_rh_lo = outside_rh;
                if (outside_rh_hi < outside_rh)
                    outside_rh_hi = outside_rh;

                let date = moment(unixTimestamp, 'X').utcOffset(tz).format('L');
                if (0 === date0)
                {
                    //console.log('First day:', date);
                    date0 = date;
                    unixTs0 = unixTimestamp;
                }
                else if (date0 !== date)
                {
                    //console.log('Saving lo/hi for previous day...');

                    temp_list_cpu.push(cpu_t_hi);
                    temp_list_inside_lo.push(inside_t_lo);
                    temp_list_inside_hi.push(inside_t_hi);
                    temp_list_outside_lo.push(outside_t_lo);
                    temp_list_outside_hi.push(outside_t_hi);
                    rh_list_inside.push(inside_rh_hi);
                    rh_list_outside.push(outside_rh_hi);
                    dates.push(date0);
                    ts.push(unixTs0);
                    n_data_points++;
                    unixTs0 = unixTimestamp;

                    //console.log('New day:', date);
                    date0 = date;

                    // Reset.
                    cpu_t_lo = 1000.0;
                    cpu_t_hi = -1000.0;
                    inside_t_lo = 1000.0;
                    inside_t_hi = -1000.0;
                    outside_t_lo = 1000.0;
                    outside_t_hi = 0.0;
                    inside_rh_lo = 100.0;
                    inside_rh_hi = 0.0;
                    outside_rh_lo = 100.0;
                    outside_rh_hi = 0.0;
                }

                //if ((interval_minute * 60) <= (unixTimestamp - unixTs0)) {
                //    temp_list_cpu.push(cpu_t);
                //    temp_list_inside.push(inside_t);
                //    temp_list_outside.push(outside_t);
                //    rh_list_inside.push(inside_rh);
                //    rh_list_outside.push(outside_rh);
                //    dates.push(moment(unixTimestamp, 'X').utcOffset(tz).format('L'));
                //    ts.push(unixTimestamp);
                //    n_data_points++;
                //    unixTs0 = unixTimestamp;
                //}
            })
            .on('end', () => {
                if (unixTs0 !== unixTimestamp) {
                    //temp_list_cpu.push(cpu_t);
                    //temp_list_inside.push(inside_t);
                    //temp_list_outside.push(outside_t);
                    //rh_list_inside.push(inside_rh);
                    //rh_list_outside.push(outside_rh);
                    //dates.push(moment(unixTimestamp, 'X').utcOffset(tz).format('L'));
                    //ts.push(unixTimestamp);
                    //n_data_points++;
                    //n_total_points++;

                    //console.log('Saving lo/hi for previous day...');

                    temp_list_cpu.push(cpu_t_hi);
                    temp_list_inside_lo.push(inside_t_lo);
                    temp_list_inside_hi.push(inside_t_hi);
                    temp_list_outside_lo.push(outside_t_lo);
                    temp_list_outside_hi.push(outside_t_hi);
                    rh_list_inside.push(inside_rh_hi);
                    rh_list_outside.push(outside_rh_hi);
                    dates.push(moment(unixTimestamp, 'X').utcOffset(tz).format('L'));
                    ts.push(unixTimestamp);
                    n_data_points++;
                    n_total_points++;
                }

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

function validate_date(d) {
    return true;
    //tree.forEach(function (value, index) {
        //let v = value.replace(/\//g, '-');
        //if (JSON.stringify(d) === JSON.stringify(v))
            //return true;
    //});
    //console.log('Date', d, 'did not validate.');
    //return false;
}

function colorize_rh_values (v) {
    let color_list = [];
    v.forEach(function (value, index) {
        if (value < 25) {
            color_list.push('rgb(0,0,255)');
        }
        else if (55 < value) {
            color_list.push('rgb(255,0,0)');
        }
        else {
            color_list.push('rgb(0,255,0)');
        }
    });
    return color_list;
}

function colorize_t_values (v) {
    let color_list = [];
    v.forEach(function (value, index) {
        if (value < 15) {
            color_list.push('rgb(0,0,255)');
        }
        else if (25 < value) {
            color_list.push('rgb(255,0,0)');
        }
        else {
            color_list.push('rgb(0,255,0)');
        }
    });
    return color_list;
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

        let start_stop_dates = generate_start_stop_dates();
        let date_min = start_stop_dates[0];
        let date_max = start_stop_dates[1];
        let start_date = start_stop_dates[0];
        let stop_date = start_stop_dates[1];
        if (in_parameters.date_start) {
            if (validate_date(in_parameters.date_start)) {
                start_date = in_parameters.date_start;
            }
            if (validate_date(in_parameters.date_start)) {
                stop_date = in_parameters.date_start;
            }
        }
        /*
        if (in_parameters.date_end)
        {
            stop_date = in_parameters.date_end;
        }
        */

        let filename = base_dir + stop_date.replace(/-/gi, '/');

        console.log('Loading file: ' + filename + '.csv');
        let promise = read_file(filename + '.csv', 60);

        promise.then(
            function (result) { /* handle a successful result */
                fs.readFile('index.html', 'utf-8', function (err, data) {
                    res.writeHead(200, {'Content-Type': 'text/html'});

                    /* Data sets */
                    data = data.replace(/{inside_temp_lo}/g, JSON.stringify(temp_list_inside_lo));
                    data = data.replace(/{inside_temp_hi}/g, JSON.stringify(temp_list_inside_hi));
                    data = data.replace(/{outside_temp_lo}/g, JSON.stringify(temp_list_outside_lo));
                    data = data.replace(/{outside_temp_hi}/g, JSON.stringify(temp_list_outside_hi));
                    data = data.replace(/{inside_rh}/g, JSON.stringify(rh_list_inside));
                    data = data.replace(/{outside_rh}/g, JSON.stringify(rh_list_outside));

                    /* Create colors based on values. */
                    //let inside_t_clr = colorize_t_values(temp_list_inside);
                    //let outside_t_clr = colorize_t_values(temp_list_outside);
                    //let inside_rh_clr = colorize_rh_values(rh_list_inside);
                    //let outside_rh_clr = colorize_rh_values(rh_list_outside);
                    //data = data.replace(/{color_inside_t}/g, JSON.stringify(inside_t_clr));
                    //data = data.replace(/{color_outside_t}/g, JSON.stringify(outside_t_clr));
                    //data = data.replace(/{color_inside_rh}/g, JSON.stringify(inside_rh_clr));
                    //data = data.replace(/{color_outside_rh}/g, JSON.stringify(outside_rh_clr));

                    /* Time series */
                    data = data.replace(/{xval}/g, JSON.stringify(ts.map(e => e * 1000)));

                    /* Debug info. */
                    data = data.replace(/{n_data_points}/g, JSON.stringify(n_data_points));
                    data = data.replace(/{n_total_points}/g, JSON.stringify(n_total_points));

                    /* Selection of date. */
                    data = data.replace(/{date_start}/g, start_date);
                    data = data.replace(/{date_end}/g, stop_date);
                    data = data.replace(/{date_min}/g, date_min);
                    data = data.replace(/{date_max}/g, date_max);

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

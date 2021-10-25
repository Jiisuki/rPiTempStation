const http = require('http');
const glob = require('glob');
const csv = require('csv-parser');
const fs = require('fs');

function get_tree (dir) {
    let tree = glob.sync(dir + '**/**/*.csv');
    tree.forEach(function (value, index) {
        tree[index] = tree[index].substr(dir.length);
        tree[index] = tree[index].substr(0, tree[index].length - '.csv'.length);
    });
    return tree;
}

let base_dir = 'temp_log/';
if (2 < process.argv.length) {
    console.log('Using base directory: "' + process.argv[2] + '"');
    base_dir = process.argv[2] + '/temp_log/';
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
    let promise = new Promise(function(resolve, reject) {
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

        /* Read the file async. */
        fs.createReadStream(file)
            .pipe(csv({headers: ['year', 'month', 'day', 'hour', 'minute', 'second', 'cpu', 'cabinet', 'inside', 'outside']}))
            .on('data', (row) => {
                date = row['year'] + '-' + row['month'] + '-' + row['day'];
                time = row['hour'] + ':' + row['minute'];

                let cpu_t = parseFloat(row['cpu']);
                let cabinet_t = parseFloat(row['cabinet']);
                let inside_t = parseFloat(row['inside']);
                let outside_t = parseFloat(row['outside']);
                let int_hour = parseInt(row['hour']);

                n_data_points++;

                if (flag_first) {
                    flag_first = false;

                    acc_cpu_t = cpu_t;
                    acc_cabinet_t = cabinet_t;
                    acc_inside_t = inside_t;
                    acc_outside_t = outside_t;

                    acc_count = 1;
                    acc_hour = int_hour;
                    mem_hour = int_hour;
                }

                if (mem_hour !== int_hour) {
                    temp_list_cpu.push(acc_cpu_t / acc_count);
                    temp_list_cabinet.push(acc_cabinet_t / acc_count);
                    temp_list_inside.push(acc_inside_t / acc_count);
                    temp_list_outside.push(acc_outside_t / acc_count);

                    dates.push(date);
                    ts.push(row['hour'] + ':00');

                    /* Setup next start. */
                    acc_cpu_t = cpu_t;
                    acc_cabinet_t = cabinet_t;
                    acc_inside_t = inside_t;
                    acc_outside_t = outside_t;

                    acc_count = 1;
                    acc_hour = int_hour;
                    mem_hour = int_hour;
                } else {
                    /* Just accumulate. */
                    acc_cpu_t += cpu_t;
                    acc_cabinet_t += cabinet_t;
                    acc_inside_t += inside_t;
                    acc_outside_t += outside_t;

                    acc_count++;
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
                }

                resolve('done');
            })
            .on('error', () => {
                reject('error');
            });
    });

    return promise;
}

var params=function(req){
    let q=req.url.split('?'),result={};
    if(q.length>=2){
        q[1].split('&').forEach((item)=>{
            try {
                result[item.split('=')[0]]=item.split('=')[1];
            } catch (e) {
                result[item.split('=')[0]]='';
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
        //console.log(in_parameters);

        let filename = base_dir + tree[tree.length - 1];
        if (in_parameters.file)
        {
            filename = base_dir + in_parameters.file.replace(/-/gi, '/');
        }

        console.log('Loading file: ' + filename + '.csv');
        let promise = read_file(filename + '.csv', false);

        promise.then(
            function (result) { /* handle a successful result */
                //console.log(filename + ' processed resulting in ' + temp_list_cpu.length + ' entries.');

                fs.readFile('index.html', 'utf-8', function (err, data) {
                    res.writeHead(200, {'Content-Type': 'text/html'});

                    /* Get date from filename */
                    let date_split = filename.split('/');
                    let pretty_date = dates[0];
                    if (date_split) {
                        pretty_date = date_split[1] + '-' + date_split[2] + '-' + date_split[3].split('.')[0];
                    }

                    /* Title */
                    data = data.replace(/{title_str}/g, pretty_date);

                    /* Data sets */
                    data = data.replace(/{cpu_temp}/g, JSON.stringify(temp_list_cpu));
                    data = data.replace(/{cabinet_temp}/g, JSON.stringify(temp_list_cabinet));
                    data = data.replace(/{inside_temp}/g, JSON.stringify(temp_list_inside));
                    data = data.replace(/{outside_temp}/g, JSON.stringify(temp_list_outside));

                    /* Time series */
                    data = data.replace(/{xval}/g, JSON.stringify(ts));

                    /* Debug info. */
                    data = data.replace(/{n_data_points}/g, JSON.stringify(n_data_points));

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

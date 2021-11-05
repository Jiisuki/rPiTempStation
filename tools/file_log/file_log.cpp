//
// Created by Jiisuki on 2021-10-24.
//

#include <iostream>

#include <gr_ipc.h>
#include <common.h>
#include <fstream>
#include <filesystem>

static void signal_handler(int v);

static common::abortable_delay* loop_delay;

using log_file_t = std::pair<std::string, std::string>;

void touch_file(const log_file_t& lf);
bool is_log_file_equal(const log_file_t& l1, const log_file_t& l2);
log_file_t get_filename_from_date(const std::string& base, const std::string& fmt);
void add_data_point(const std::string& filename, const std::string& csv);
void write_last_minute_data_point(const std::string& filename, const std::string& csv);

int main ()
{
    /* Try to get current date as a file name. */
    auto current_filename = get_filename_from_date("/home/pi/temp_log/minute_logs/", ".csv");
    std::cout << "Writing temperatures to " << current_filename.first << current_filename.second << std::endl;
    touch_file(current_filename);

    auto last_update_filename = "/home/pi/temp_log/last_minute.csv";

    loop_delay = new common::abortable_delay (100);
    const auto write_interval_min = 15;

    ipc::context_t ctx {};
    ipc::subscriber subscriber (ctx, "temp");

    common::average<float, 60> inside_avg_t {};
    common::average<float, 60> inside_avg_rh {};
    common::average<float, 60> outside_avg_t {};
    common::average<float, 60> outside_avg_rh {};

    auto previous_minute = -1;

    do
    {
        try
        {
            common::temp_data data {};
            if (subscriber.poll(&data, sizeof(common::temp_data)))
            {
                /* Allocate average of last minute or so. */
                inside_avg_t.add(data.inside_t);
                inside_avg_rh.add(data.inside_rh);
                outside_avg_t.add(data.outside_t);
                outside_avg_rh.add(data.outside_rh);

                /* Get current time reference. */
                auto now = std::time(nullptr);
                auto t = std::localtime(&now);
                if ((previous_minute != t->tm_min) && (0 == (t->tm_min % write_interval_min)))
                {
                    previous_minute = t->tm_min;

                    const auto f = get_filename_from_date("/home/pi/temp_log/minute_logs/", ".csv");
                    if (!is_log_file_equal(f, current_filename))
                    {
                        std::cout << "Switching log file to: " << f.first << f.second << std::endl;
                        current_filename = f;
                        touch_file(current_filename);
                    }

                    /* Write CSV using that average of the last minute. */
                    std::stringstream ss{};
                    ss << std::to_string(data.unix_ts) << ",";
                    ss << std::to_string(data.cpu_t) << ",";
                    ss << std::to_string(inside_avg_t.mean()) << ",";
                    ss << std::to_string(inside_avg_rh.mean()) << ",";
                    ss << std::to_string(outside_avg_t.mean()) << ",";
                    ss << std::to_string(outside_avg_rh.mean());

                    add_data_point(current_filename.first + current_filename.second, ss.str());
                }

                /* If a minute has passed, write last minute info. */
                static auto last_minute = 0;
                if (last_minute != t->tm_min)
                {
                    last_minute = t->tm_min;

                    std::stringstream ss{};

                    ss << std::to_string(data.unix_ts) << ",";
                    ss << std::to_string(data.cpu_t) << ",";
                    ss << std::to_string(inside_avg_t.mean()) << ",";
                    ss << std::to_string(inside_avg_rh.mean()) << ",";
                    ss << std::to_string(outside_avg_t.mean()) << ",";
                    ss << std::to_string(outside_avg_rh.mean());

                    write_last_minute_data_point(last_update_filename, ss.str());
                }
            }
        }
        catch (const zmq::error_t& error)
        {
            std::cerr << error.what() << std::endl;
            loop_delay->abort();
        }
    }
    while (loop_delay->wait());

    delete loop_delay;

    return (0);
}

void add_data_point(const std::string& filename, const std::string& csv)
{
    std::ofstream out(filename, std::ios::app);
    if (out.is_open())
    {
        out << csv << std::endl;
        out.close();
    }
    else
    {
        std::cerr << "Error writing to file " << filename << std::endl;
    }
}

void write_last_minute_data_point(const std::string& filename, const std::string& csv)
{
    std::ofstream out(filename, std::ios::out);
    if (out.is_open())
    {
        out << csv << std::endl;
        out.close();
    }
    else
    {
        std::cerr << "Error writing to file " << filename << std::endl;
    }
}

log_file_t get_filename_from_date(const std::string& base, const std::string& fmt)
{
    auto time = std::time(nullptr);

    /* Generate path */
    std::stringstream ss_path {};
    std::stringstream ss_file {};
    ss_path << base << std::put_time(std::localtime(&time), "%Y/");
    ss_file << std::put_time(std::localtime(&time), "%m") << fmt;
    log_file_t lf (ss_path.str(), ss_file.str());
    return (std::move(lf));
}

void touch_file(const log_file_t& lf)
{
    if (!std::filesystem::exists(lf.first))
    {
        std::filesystem::create_directories(lf.first);
        std::cout << "Created path " << lf.first << std::endl;
    }
}

bool is_log_file_equal(const log_file_t& l1, const log_file_t& l2)
{
    return ((l1.first == l2.first) && (l1.second == l2.second));
}

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

int main ()
{
    /* Try to get current date as a file name. */
    auto current_filename = get_filename_from_date("/home/pi/temp_log/", ".csv");
    std::cout << "Writing temperatures to " << current_filename.first << current_filename.second << std::endl;
    touch_file(current_filename);

    loop_delay = new common::abortable_delay (100);

    ipc::context_t ctx {};
    ipc::subscriber subscriber (ctx, "temp");

    do
    {
        const auto f = get_filename_from_date("/home/pi/temp_log/", ".csv");
        if (!is_log_file_equal(f, current_filename))
        {
            std::cout << "Switching log file to: " << f.first << f.second << std::endl;
            current_filename = f;
            touch_file(current_filename);
        }

        std::string topic {};
        std::string msg {};
        try
        {
            if (subscriber.poll(topic, msg))
            {
                add_data_point(current_filename.first + current_filename.second, msg);
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

log_file_t get_filename_from_date(const std::string& base, const std::string& fmt)
{
    auto time = std::time(nullptr);

    /* Generate path */
    std::stringstream ss_path {};
    std::stringstream ss_file {};
    ss_path << base << std::put_time(std::localtime(&time), "%Y/%m/");
    ss_file << std::put_time(std::localtime(&time), "%d") << fmt;
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

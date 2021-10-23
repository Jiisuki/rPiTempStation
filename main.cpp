#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <chrono>
#include <signal.h>
#include <atomic>
#include <utility>
#include <vector>

#include <cpu_temp.h>

static void signal_handler(int v);
static void monitor_thread();

static bool kill_signal;
static std::condition_variable cv;
static std::mutex m;

static std::vector<std::pair<unsigned int, float>> cpu_temp_log;

int main()
{
    signal(SIGINT, signal_handler);

    /* Creating sub-modules. */
    cpu_temp::reader module_cpu_temp {};

    /* Wait for kill signal. */
    while (!kill_signal)
    {
        auto unix_time = (unsigned int) std::time(nullptr);
        auto temp_cpu = module_cpu_temp.read();
        std::pair<unsigned int, float> log_entry (unix_time, temp_cpu);
        cpu_temp_log.push_back(log_entry);

        std::cout << "cpu temp: " << temp_cpu << " deg. Number of log entries: " << cpu_temp_log.size() << std::endl;

        std::unique_lock<std::mutex> uniqueLock(m);
        (void) cv.wait_for(uniqueLock, std::chrono::seconds(5), [] {return kill_signal;});
    }
    return 0;
}

static void signal_handler(int v)
{
    {
        std::unique_lock<std::mutex> uniqueLock(m);
        kill_signal = true;
    }
    cv.notify_one();
}

static void monitor_thread()
{
}


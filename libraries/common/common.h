#pragma once

#include <thread>
#include <mutex>
#include <condition_variable>

namespace common
{
    class abortable_delay
    {
    public:
        explicit abortable_delay(const unsigned int t_ms) : kill_signal(false), time_ms(t_ms), cv(), m() {}
        ~abortable_delay() = default;
        bool wait()
        {
            std::unique_lock<std::mutex> uniqueLock(m);
            return !cv.wait_for(uniqueLock, std::chrono::milliseconds (time_ms), [this] { return kill_signal; });
        }
        void abort()
        {
            {
                std::unique_lock<std::mutex> uniqueLock(m);
                kill_signal = true;
            }
            cv.notify_one();
        }

    private:
        bool kill_signal;
        unsigned int time_ms;
        std::condition_variable cv;
        std::mutex m;
    };

}

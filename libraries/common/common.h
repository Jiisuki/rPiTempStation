#pragma once

#include <thread>
#include <mutex>
#include <condition_variable>
#include <deque>

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

    struct temp_data
    {
        unsigned int unix_ts;
        float cpu_t;
        float inside_t;
        float inside_rh;
        float outside_t;
        float outside_rh;
    };

    template <typename T, unsigned int max_size>
    class average
    {
    public:
        average() : points () {}
        ~average() = default;

        void add (T v)
        {
            if (max_size <= points.size())
            {
                points.pop_front();
            }
            points.push_back(v);
        }

        [[nodiscard]] T mean() const
        {
            T m = 0;
            if (!points.empty())
            {
                for (auto& v: points)
                {
                    m += v;
                }
                m /= points.size();
            }
            return m;
        }

        [[nodiscard]] std::pair<T, T> range() const
        {
            std::pair<T, T> m (0, 0);
            if (!points.empty())
            {
                m.first = points.front();
                m.second = points.front();
                for (auto& v : points)
                {
                    if (v < m.first)
                    {
                        m.first = v;
                    }
                    if (m.second < v)
                    {
                        m.second = v;
                    }
                }
            }
            return m;
        }

        [[nodiscard]] unsigned int n() const
        {
            return points.size();
        }

    private:
        std::deque<T> points;
    };
}

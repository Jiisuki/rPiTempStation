#include <iostream>
#include <chrono>
#include <signal.h>
#include <utility>
#include <vector>

#include <cpu_temp.h>
#include <gr_ipc.h>
#include <common.h>

static void signal_handler(int v);

static common::abortable_delay* loop_delay;

int main()
{
    loop_delay = new common::abortable_delay (60000);

    signal(SIGINT, signal_handler);

    /* Creating sub-modules. */
    cpu_temp::reader module_cpu_temp {};

    /* Creating publisher. */
    ipc::context_t ctx {};
    ipc::publisher publisher (ctx, "temp");

    /* Wait for kill signal. */
    do
    {
        auto temp_cpu = module_cpu_temp.read();

        std::stringstream ss {};

        /* Format:
         *   YYYY, mm, dd, h, M, s, cpu, ...
         */

        auto time = std::time(nullptr);

        /* Generate path */
        ss << std::put_time(std::localtime(&time), "%Y, %m, %d, %H, %M, %S") << ", ";
        ss << std::to_string(temp_cpu);

        publisher.publish(ss.str());
    }
    while (loop_delay->wait());

    delete loop_delay;

    return 0;
}

static void signal_handler(int v)
{
    (void) v;
    if (nullptr != loop_delay)
    {
        loop_delay->abort();
    }
}


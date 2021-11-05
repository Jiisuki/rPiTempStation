#include <iostream>
#include <chrono>
#include <signal.h>
#include <utility>
#include <vector>

#include <cpu_temp.h>
#include <sht31d.h>

#include <gr_ipc.h>
#include <common.h>

static void signal_handler(int v);

static common::abortable_delay* loop_delay;

int main()
{
    loop_delay = new common::abortable_delay (100);

    signal(SIGINT, signal_handler);

    /* Creating sub-modules. */
    cpu_temp::reader module_cpu_temp {};
    sht31d::reader module_inside (0x44);
    sht31d::reader module_outside (0x45);

    /* Creating publisher. */
    ipc::context_t ctx {};
    ipc::publisher publisher (ctx, "temp");

    auto prev_ts = (unsigned int) std::time(nullptr);

    /* Wait for kill signal. */
    do
    {
        /* Only publish every new second. */
        auto unix_ts = (unsigned int) std::time(nullptr);
        if (unix_ts != prev_ts)
        {
            prev_ts = unix_ts;
            auto temp_cpu = module_cpu_temp.read();
            auto inside_data = module_inside.get();
            auto outside_data = module_outside.get();

            common::temp_data data {};
            data.unix_ts = unix_ts;
            data.cpu_t = temp_cpu;
            data.inside_t = inside_data.temperature;
            data.inside_rh = inside_data.relative_humidity;
            data.outside_t = outside_data.temperature;
            data.outside_rh = outside_data.relative_humidity;

            publisher.publish(&data, sizeof(common::temp_data));
        }
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

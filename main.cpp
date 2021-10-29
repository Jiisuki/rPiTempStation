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

float to_be_remoded_random_float(float min, float max);

static common::abortable_delay* loop_delay;

int main()
{
    loop_delay = new common::abortable_delay (1000);

    signal(SIGINT, signal_handler);

    /* Creating sub-modules. */
    cpu_temp::reader module_cpu_temp {};
    sht31d::reader module_inside (0x44);
    // todo:
    //sht31d::reader module_outside (0x45);

    /* Creating publisher. */
    ipc::context_t ctx {};
    ipc::publisher publisher (ctx, "temp");

    /* Wait for kill signal. */
    do
    {
        auto temp_cpu = module_cpu_temp.read();
        auto inside_data = module_inside.get();
        // todo:
        //auto outside_data = module_outside.get();

        std::stringstream ss {};

        /* Format:
         *   unix_ts, cpu, inside_t, inside_rh, outside_t, outside_rh
         */

        auto time = std::time(nullptr);

        /* Generate path */
        //ss << std::put_time(std::localtime(&time), "%Y,%m,%d,%H,%M,%S") << ",";
        ss << std::to_string((unsigned int) time) << ",";
        ss << std::to_string(temp_cpu) << ",";
        ss << std::to_string(inside_data.temperature) << ",";
        ss << std::to_string(inside_data.relative_humidity) << ",";
        // dummies:
        ss << std::to_string(0) << ",";
        ss << std::to_string(0);
        // todo:
        //ss << std::to_string(outside_data.temperature) << ",";
        //ss << std::to_string(outside_data.relative_humidity);

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

float to_be_remoded_random_float(float min, float max)
{
    // this  function assumes max > min, you may want
    // more robust error checking for a non-debug build
    assert(max > min);
    float random = ((float) rand()) / (float) RAND_MAX;

    // generate (in your case) a float between 0 and (4.5-.78)
    // then add .78, giving you a float between .78 and 4.5
    float range = max - min;
    return (random*range) + min;
}

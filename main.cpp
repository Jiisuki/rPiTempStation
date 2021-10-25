#include <iostream>
#include <chrono>
#include <signal.h>
#include <utility>
#include <vector>

#include <cpu_temp.h>
#include <gr_ipc.h>
#include <common.h>

static void signal_handler(int v);

float to_be_remoded_random_float(float min, float max);

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

        /* Dummies */
        auto temp_inside = temp_cpu - to_be_remoded_random_float(30, 40);
        auto temp_outside = temp_inside - to_be_remoded_random_float(-10, 10);
        auto temp_cabinet = temp_cpu - to_be_remoded_random_float(0, 20);

        std::stringstream ss {};

        /* Format:
         *   YYYY, mm, dd, h, M, s, cpu, cabinet, inside, outside
         */

        auto time = std::time(nullptr);

        /* Generate path */
        ss << std::put_time(std::localtime(&time), "%Y,%m,%d,%H,%M,%S") << ",";
        ss << std::to_string(temp_cpu) << ",";
        ss << std::to_string(temp_cabinet) << ",";
        ss << std::to_string(temp_inside) << ",";
        ss << std::to_string(temp_outside);

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

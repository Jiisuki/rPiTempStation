//
// Created by Jiisuki on 2021-10-24.
//

#include <iostream>

#include <gr_ipc.h>
#include <common.h>

static void signal_handler(int v);

static common::abortable_delay* loop_delay;

int main ()
{
    loop_delay = new common::abortable_delay (100);

    ipc::context_t ctx {};
    ipc::subscriber subscriber (ctx, "");

    do
    {
        std::string topic {};
        std::string msg {};
        try
        {
            if (subscriber.poll(topic, msg))
            {
                std::cout << topic << ": " << msg << std::endl;
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

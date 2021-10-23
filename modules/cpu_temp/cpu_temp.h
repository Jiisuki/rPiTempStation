//
// Created by Jiisuki on 2021-10-23.
//

#pragma once

#include <mutex>
#include <condition_variable>
#include <thread>

namespace cpu_temp
{
    class reader
    {
    public:
        reader() {}
        ~reader() = default;
        float read();

    private:
    };
}

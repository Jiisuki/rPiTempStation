//
// Created by Jiisuki on 2021-10-23.
//

#include "cpu_temp.h"

#include <iostream>
#include <cstdio>

namespace cpu_temp
{
    float reader::read()
    {
        float systemp, millideg;
        FILE* thermal;
        int n;

        thermal = fopen("/sys/class/thermal/thermal_zone0/temp", "r");
        (void) fscanf(thermal, "%f", &millideg);
        fclose(thermal);
        systemp = millideg / 1000;

        return (systemp);
    }
}

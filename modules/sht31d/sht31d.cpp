//
// Created by Jiisuki on 2021-10-29.
//

#include "sht31d.h"

#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

#include <thread>
#include <chrono>

namespace sht31d
{
    reader::reader(std::uint8_t address) : length(), file_i2c(), is_open(false)
    {
        //----- OPEN THE I2C BUS -----
        const char* filename = "/dev/i2c-1";
        if ((file_i2c = open(filename, O_RDWR)) < 0)
        {
            //ERROR HANDLING: you can check errno to see what went wrong
            throw exception("Failed to open I2C bus.");
        }

        if (ioctl(file_i2c, I2C_SLAVE, address) < 0)
        {
            throw exception("Failed to acquire bus access and/or talk to slave.");
        }

        is_open = true;
    }

    reader::~reader()
    {
        if (is_open)
        {
            close(file_i2c);
        }
    }

    data reader::get() const
    {
        float v = 0;
        /* todo */
        std::uint8_t command[] = {0x24, 0x00};
        transmit(command, sizeof(command));

        std::this_thread::sleep_for(std::chrono::milliseconds(50));

        std::uint8_t data_and_crc[6] {};
        receive(data_and_crc, sizeof(data_and_crc));

        auto s_t = (std::int16_t) (((std::uint16_t) data_and_crc[0] << 8) | data_and_crc[1]);
        auto s_rh = (std::int16_t) (((std::uint16_t) data_and_crc[3] << 8) | data_and_crc[4]);

        float rh = 100.0f * ((float) s_rh / 65535);
        float t = -45.0f + 175.0f * ((float) s_t / 65535);

        return {t, rh};
    }

    void reader::transmit(const std::uint8_t* buffer, std::size_t size) const
    {
        if (write(file_i2c, buffer, size) != size)		//write() returns the number of bytes actually written, if it doesn't match then an error occurred (e.g. no response from the device)
        {
            throw exception ("Failed to write to the i2c bus.");
        }
    }

    void reader::receive(std::uint8_t* buffer, std::size_t size) const
    {
        if (read(file_i2c, buffer, size) != size)		//read() returns the number of bytes actually read, if it doesn't match then an error occurred (e.g. no response from the device)
        {
            //ERROR HANDLING: i2c transaction failed
            throw exception ("Failed to read from the i2c bus.");
        }
        else
        {
            printf("Data read: %s\n", buffer);
        }
    }
}

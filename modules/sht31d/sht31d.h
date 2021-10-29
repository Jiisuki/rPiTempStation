//
// Created by Jiisuki on 2021-10-29.
//

#pragma once

#include <exception>
#include <string>

namespace sht31d
{
    struct exception : std::exception
    {
        explicit exception(std::string msg) : msg(std::move(msg)) {}
        [[nodiscard]] const char* what() const noexcept override
        {
            return (msg.c_str());
        }
    private:
        std::string msg;
    };

    struct data
    {
        float temperature;
        float relative_humidity;

        data() : temperature(0.0f), relative_humidity(0.0f) {}
        data(float t, float rh) : temperature(t), relative_humidity(rh) {}
        ~data() = default;
    };

    class reader
    {
    public:
        explicit reader(std::uint8_t address);
        ~reader();
        [[nodiscard]] data get() const;

    private:
        int file_i2c;
        int length;
        bool is_open;
        void transmit(const std::uint8_t* buffer, std::size_t size) const;
        void receive(std::uint8_t* buffer, std::size_t size) const;
    };
}

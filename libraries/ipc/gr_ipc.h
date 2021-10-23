#pragma once

#include <utility>
#include <zmq.hpp>
#include <sstream>

namespace ipc
{
    using context_t = zmq::context_t;

    std::string get_version();

    class subscriber
    {
    private:
        zmq::socket_t socket;

    public:
        explicit subscriber(context_t& ctx, const std::string& topic) : socket(ctx, zmq::socket_type::sub)
        {
            socket.connect("tcp://localhost:5555");
            socket.set(zmq::sockopt::subscribe, topic);
        }

        bool poll(std::string& topic, std::string& msg)
        {
            zmq::message_t zmq_topic{};
            zmq::message_t zmq_msg{};
            auto rc = socket.recv(zmq_topic);
            if (rc)
            {
                topic = zmq_topic.to_string();
                rc = socket.recv(zmq_msg);
                if (rc)
                {
                    msg = zmq_msg.to_string();
                    return (true);
                }
            }
            return (false);
        }

        bool poll(std::string& str)
        {
            std::string topic {};
            return (poll(topic, str));
        }

        bool poll(void* data, const size_t size)
        {
            zmq::message_t topic{};
            zmq::message_t msg{};
            auto rc = socket.recv(topic);
            if (rc)
            {
                rc = socket.recv(msg);
            }

            if (rc)
            {
                if (msg.size() == size)
                {
                    memcpy(data, msg.data(), msg.size());
                    return (true);
                }
            }

            return (false);
        }
    };

    class publisher
    {
    private:
        zmq::socket_t socket;
        zmq::message_t msg_topic;

    public:
        explicit publisher(context_t& ctx, const std::string& topic) : msg_topic(topic), socket(ctx, zmq::socket_type::pub)
        {
            socket.bind("tcp://*:5555");
        }

        void publish(const std::string& string)
        {
            zmq::message_t msg_data (string.length());
            memcpy(msg_data.data(), string.c_str(), string.length());
            socket.send(msg_topic, zmq::send_flags::sndmore);
            socket.send(msg_data, zmq::send_flags::none);
        }

        void publish(void* data_structure, const size_t data_size)
        {
            zmq::message_t msg_data (data_size);
            memcpy(msg_data.data(), data_structure, data_size);
            socket.send(msg_topic, zmq::send_flags::sndmore);
            socket.send(msg_data, zmq::send_flags::none);
        }
    };
}

#include "gr_ipc.h"

namespace ipc
{
    std::string get_version()
    {
        auto v = zmq::version();
        std::stringstream ss {};
        ss << std::get<0>(v) << "."
           << std::get<1>(v) << "."
           << std::get<2>(v);
        return (ss.str());
    }
}

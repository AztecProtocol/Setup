#pragma once

#include <stddef.h>

namespace batch_normalize
{
    template <typename FieldT, typename GroupT>
    void batch_normalize(size_t start, size_t number, GroupT *x)
    {
        FieldT accumulator = FieldT::one();
        FieldT* temporaries = static_cast<FieldT *>(malloc(number * sizeof(FieldT)));
        for (size_t i = 0; i < number; ++i)
        {
            temporaries[i] = accumulator;
            accumulator = accumulator * x[i + start].Z;
        }
        accumulator = accumulator.inverse();

        FieldT zzInv;
        FieldT zInv;
        for (size_t i = number - 1; i < (size_t)(-1); --i)
        {
            zInv = accumulator * temporaries[i];
            zzInv = zInv * zInv;
            x[i + start].X = x[i + start].X * zzInv;
            x[i + start].Y = x[i + start].Y * (zzInv * zInv);
            accumulator = accumulator * x[i + start].Z; // temporaries[2 * i + 1];
            x[i + start].Z = FieldT::one();
        }
        free(temporaries);
    }
}
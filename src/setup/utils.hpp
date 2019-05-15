#pragma once

#include <stddef.h>

namespace utils
{
    template <typename FieldT, typename GroupT>
    void batch_normalize(size_t start, size_t number, GroupT *x, GroupT *alpha_x)
    {
        FieldT accumulator = FieldT::one();
        FieldT* temporaries = static_cast<FieldT *>(malloc(2 * number * sizeof(FieldT)));
        for (size_t i = 0; i < number; ++i)
        {
            temporaries[2 * i] = accumulator;
            accumulator = accumulator * x[i + start].Z;
            temporaries[2 * i + 1] = accumulator;
            accumulator = accumulator * alpha_x[i + start].Z;
        }
        accumulator = accumulator.inverse();

        FieldT zzInv;
        FieldT zInv;
        for (size_t i = number - 1; i < (size_t)(-1); --i)
        {
            zInv = accumulator * temporaries[2 * i + 1];
            zzInv = zInv * zInv;
            alpha_x[i + start].X = alpha_x[i + start].X * zzInv;
            alpha_x[i + start].Y = alpha_x[i + start].Y * (zzInv * zInv);
            accumulator = accumulator * alpha_x[i + start].Z; // temporaries[2 * i + 1];
            alpha_x[i + start].Z = FieldT::one();
            zInv = accumulator * temporaries[2 * i];
            zzInv = zInv * zInv;
            x[i + start].X = x[i + start].X * zzInv;
            x[i + start].Y = x[i + start].Y * (zzInv * zInv);
            accumulator = accumulator * x[i + start].Z; // temporaries[2 * i + 1];
            x[i + start].Z = FieldT::one();
        }
        free(temporaries);
    }
}
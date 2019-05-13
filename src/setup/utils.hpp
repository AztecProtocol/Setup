#include <stddef.h>

namespace utils
{
    template <typename FieldT, typename GroupT>
    void batch_normalize(size_t start, size_t number, GroupT *x, GroupT *alpha_x)
    {
        FieldT accumulator = FieldT::one();
        FieldT *temporaries;
        temporaries = static_cast<FieldT *>(malloc(2 * number * sizeof(FieldT)));
        for (size_t i = 0; i < number; ++i)
        {
            temporaries[2 * i] = accumulator;
            accumulator = accumulator * x[i + start].Z;
            temporaries[2 * i + 1] = accumulator;
            accumulator = accumulator * alpha_x[i + start].Z;
        }
        accumulator = accumulator.inverse();

        FieldT zzInv;
        for (size_t i = number; i > 0; --i)
        {
            accumulator = accumulator * temporaries[2 * i + 1];
            zzInv = accumulator * accumulator;
            alpha_x[i + start].X = alpha_x[i + start].X * zzInv;
            alpha_x[i + start].Y = alpha_x[i + start].Y * (zzInv * accumulator);
            accumulator = accumulator * temporaries[2 * i];
            zzInv = accumulator * accumulator;
            x[i + start].X = x[i + start].X * zzInv;
            x[i + start].Y = x[i + start].Y * (zzInv * accumulator);
        }
        free(temporaries);
    }
}
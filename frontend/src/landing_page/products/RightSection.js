import React from 'react';

function RightSection({
    imageURL,
    productName,
    productDescription,
    learnMore
}) {
    return (
        <div className="container-fluid mt-3 px-5">
            <div
                className="row align-items-center"
                style={{ minHeight: "400px" }}
            >
                {/* Left Content */}
                <div
                    className="col-6 md-6"
                    style={{
                        paddingLeft: "65px",
                        paddingRight: "80px"
                    }}
                >
                    <h1
                        style={{
                            fontSize: "30px",
                            fontWeight: "400",
                            color: "#424242",
                            marginBottom: "25px"
                        }}
                    >
                        {productName}
                    </h1>

                    <p
                        style={{
                            fontSize: "18px",
                            lineHeight: "1.5",
                            color: "#424242",
                            marginBottom: "28px"
                        }}
                    >
                        {productDescription}
                    </p>

                    <div
                        className="d-flex flex-wrap"
                        style={{ gap: "70px", marginBottom: "30px" }}
                    >
                        <a
                            href={learnMore}
                            className="text-decoration-none"
                            style={{
                                fontSize: "17px",
                                color: "#387ed1"
                            }}
                        >
                            Learn more&nbsp; →
                        </a>
                    </div>
                </div>

                {/* Right Image */}
                <div className="col-6 md-6 text-center">
                    <img
                        src={imageURL}
                        alt={productName}
                        className="img-fluid"
                        style={{
                            width: "100%",
                            maxWidth: "850px",
                            height: "auto"
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default RightSection;
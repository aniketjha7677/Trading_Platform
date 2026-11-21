import React from 'react'

function Universe() {
    return (
        <div className="container mt-5">
            <div className="row text-center">
                <h1>The VeloTrade Universe</h1>
                <p>Extend your trading and investment experience even further with our partner platforms</p>
                <div className="col-4 p-3 mt-3">
                    <img src="media/images/smallcaseLogo.png" />
                    <p className='text-muted text-small'>Thematic investment platform</p>
                </div>
                <div className="col-4 p-3 mt-3">
                    <img src="media/images/streakLogo.png" style={{width:"50%"}} />
                    <p className='text-muted text-small'>Algo & strategy platform</p>
                </div>
                <div className="col-4 p-3 mt-3">
                    <img src="media/images/sensibullLogo.svg" style={{width:"70%"}} />
                    <p className='text-muted text-small'>Options trading platform</p>
                </div>

                <div className="col-4 p-3 mt-5">
                    <img src="media/images/VelotradeFundhouse.png" style={{width:"50%"}} />
                    <p className='text-muted text-small'>Asset management</p>
                </div>
                <div className="col-4 p-3 mt-5">
                    <img src="media/images/goldenpiLogo.png" style={{width:"60%"}} />
                    <p className='text-muted text-small'>Bonds trading platform</p>
                </div>
                <div className="col-4 p-3 mt-4">
                    <img src="media/images/dittoLogo.png" style={{width:"50%"}} />
                    <p className='text-muted text-small'>Insurence</p>
                </div>
                <button className='p-2 btn btn-primary fs-5 mb-5 mt-3' style={{width:"20%", margin:"0 auto"}}>Signup Now</button>
            </div>
        </div>
    );
}

export default Universe;